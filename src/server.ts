import {
  Issuer,
  generators,
  Client,
  ResponseType,
  TokenSet,
} from "openid-client";
import redis from "async-redis";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { v4 as uuidv4 } from "uuid";

const { NODE_ENV } = process.env;
const dev = NODE_ENV === "development";

interface Options {
  issuerURL: string;
  clientID: string;
  clientSecret: string;
  redirectURI: string;
  sessionMaxAge: number;
  authRequestMaxAge: number;
  authPath: string;
  protectedPath: string;
  authSuccessfulRedirectPath: string;
  authFailedRedirectPath: string;
  callbackPath: string;
  scope: string;
  refreshPath: string;
  redisOption: {
    host?: string;
    port?: number;
    path?: string;
    password?: string;
    family?: string;
    tls?: any;
  };
  domain?: string;
}

export class SapperOIDCClient {
  private clientID: string;
  private clientSecret: string;
  private redirectURI: string;
  private responseTypes: [ResponseType];
  private domain: string;
  private sessionMaxAge: number;
  private authRequestMaxAge: number;
  private issuerURL: string;
  private client!: Client;
  private redis: any;
  private authPath: string;
  private protectedPath: string;
  private callbackPath: string;
  private authSuccessfulRedirectPath: string;
  private authFailedRedirectPath: string;
  private refreshPath: string;
  private scope: string;
  private ok!: boolean;

  constructor(options: Options) {
    this.clientID = options.clientID;
    this.clientSecret = options.clientSecret;
    this.redirectURI = options.redirectURI;
    this.responseTypes = ["code"];
    this.issuerURL = options.issuerURL;
    this.sessionMaxAge = options.sessionMaxAge;
    this.authRequestMaxAge = options.authRequestMaxAge;
    this.redis = redis.createClient(options.redisOption);
    this.authPath = options.authPath;
    this.protectedPath = options.protectedPath;
    this.callbackPath = options.callbackPath;
    this.authSuccessfulRedirectPath = options.authSuccessfulRedirectPath;
    this.authFailedRedirectPath = options.authFailedRedirectPath;
    this.refreshPath = options.refreshPath;
    this.domain = options.domain ? options.domain : "";
    this.scope = options.scope;
  }
  async init() {
    const discoveredIssuer = await Issuer.discover(this.issuerURL);
    this.client = new discoveredIssuer.Client({
      client_id: this.clientID,
      client_secret: this.clientSecret,
      redirect_uris: [this.redirectURI],
      response_types: this.responseTypes,
    });
    this.ok = true;
  }
  middleware() {
    if (!this.ok) throw new Error("Middfleware used before initialization");
    return async (req: any, res: any, next: any) => {
      const path = req.originalUrl.replace(/\?.*$/, "");

      // polka doesn't have res.redirect
      res.redirect = (location: string) => {
        let str = `Redirecting to ${location}`;
        res.writeHead(302, {
          Location: location,
          "Content-Type": "text/plain",
          "Content-Length": str.length,
        });
        res.end(str);
      };
      if (path === this.authPath) {
        const state = generators.state();
        const stateID = uuidv4();
        await this.redis.set(stateID, state, "EX", this.authRequestMaxAge);
        res.setHeader(
          "Set-Cookie",
          serializeCookie("state", String(stateID), {
            httpOnly: true,
            secure: !dev,
            sameSite: true,
            maxAge: this.authRequestMaxAge, // 1 week
            domain: this.domain,
            path: "/",
          })
        );

        const redirectURL = this.client.authorizationUrl({
          scope: this.scope,
          code_challenge_method: "S256",
          state,
        });
        res.redirect(redirectURL);
      } else if (path === this.callbackPath) {
        const params = this.client.callbackParams(req);
        const stateID = parseCookie(req.headers.cookie).state;
        try {
          if (typeof stateID === "undefined" || stateID === "")
            throw new Error("No state");

          const state = await this.redis.get(stateID);
          const tokenSet = await this.client.callback(
            this.redirectURI,
            params,
            {
              state,
            }
          );
          const resultToStore = {
            raw: tokenSet,
            claimed: tokenSet.claims(),
          };
          const resultToBrowser = {
            // We don't want the refresh token to be sent to the browser
            raw: {
              access_token: tokenSet.access_token,
              id_token: tokenSet.id_token,
              expires_at: tokenSet.expires_at,
              scope: tokenSet.scope,
              token_type: tokenSet.token_type,
            },
            claimed: tokenSet.claims(),
          };
          req.user = resultToBrowser;
          const SID = uuidv4();
          await this.redis.set(
            SID,
            JSON.stringify(resultToStore),
            "EX",
            this.sessionMaxAge
          );
          res.setHeader("Set-Cookie", [
            serializeCookie("SID", String(SID), {
              httpOnly: true,
              secure: !dev,
              sameSite: true,
              maxAge: this.sessionMaxAge,
              domain: this.domain,
              path: "/",
            }),
            serializeCookie("state", "", {
              httpOnly: true,
              secure: !dev,
              sameSite: true,
              maxAge: 1,
              domain: this.domain,
              path: "/",
            }),
          ]);
          await this.redis.del(stateID);
          res.redirect(this.authSuccessfulRedirectPath);
        } catch (error) {
          res.redirect(this.authFailedRedirectPath);
        }
      } else if (path === this.refreshPath || path === this.protectedPath) {
        const token = await getTokenSetFromCookie(req, this.redis);
        const SID = getSIDFromCookie(req);
        if (token && SID) {
          const { toBrowser, toStore } = await getRefreshedTokenSetAndClaims(
            token,
            this.client
          );
          await updateToStore(SID, toStore, this.redis);
          if (path === this.protectedPath) {
            req.user = toBrowser;
            next();
          } else {
            res.end(toBrowser);
          }
        } else {
          next();
        }
      } else {
        next();
      }
    };
  }
}

function getSIDFromCookie(req: any): string | undefined {
  return req.headers.cookie ? parseCookie(req.headers.cookie).SID : undefined;
}

async function getTokenSetFromCookie(
  req: any,
  redisClient: any
): Promise<TokenSet | undefined> {
  const SID = getSIDFromCookie(req);
  if (SID) {
    const json = await redisClient.get(SID);
    const raw = json ? JSON.parse(json).raw : undefined;
    return raw ? new TokenSet(raw) : undefined;
  } else {
    return undefined;
  }
}

async function getRefreshedTokenSetAndClaims(
  tokenSet: TokenSet,
  client: Client
): Promise<{ toStore: any; toBrowser: any }> {
  //TODO: Strict type on return;
  const refreshedTokenSet = await client.refresh(tokenSet);
  const resultToStore = {
    raw: refreshedTokenSet,
    claimed: refreshedTokenSet.claims(),
  };
  const resultToBrowser = {
    // We don't want the refresh token to be sent to the browser
    raw: {
      access_token: refreshedTokenSet.access_token,
      id_token: refreshedTokenSet.id_token,
      expires_at: refreshedTokenSet.expires_at,
      scope: refreshedTokenSet.scope,
      token_type: refreshedTokenSet.token_type,
    },
    claimed: refreshedTokenSet.claims(),
  };
  return { toStore: resultToStore, toBrowser: resultToBrowser };
}
async function updateToStore(SID: string, toStore: any, redisClient: any) {
  await redisClient.set(SID, JSON.stringify(toStore), "KEEPTTL");
}
