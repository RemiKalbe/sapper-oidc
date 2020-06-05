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
import { ProtectedPath, isProtectedPath } from "./both";

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
  protectedPaths: [ProtectedPath];
  authSuccessfulRedirectPath: string;
  authFailedRedirectPath: string;
  callbackPath: string;
  scope: string;
  refreshPath: string;
  redisURL?: string;
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
  private protectedPaths: [ProtectedPath];
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
    this.redis = options.redisURL
      ? redis.createClient({ url: options.redisURL })
      : redis.createClient();
    this.authPath = options.authPath;
    this.protectedPaths = options.protectedPaths;
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
      // we get the current path without any query string
      const path = req.originalUrl.replace(/\?.*$/, "");
      // We don't want our tokens to be refreshed when the browser fetch static files.
      if (!path.includes(".")) {
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

        let userHasValidSession = false;
        // if a session exist, we get the token set, then we refresh the tokens and data,
        // we then update the DB, and finaly we pass the informations to the sapper middleware.
        const token = await getTokenSetFromCookie(req, this.redis);
        const SID = getSIDFromCookie(req);
        if (
          token !== undefined &&
          token !== null &&
          SID !== undefined &&
          SID !== null
        ) {
          if (dev) console.log("Has a SID cookie");
          try {
            const { toBrowser, toStore } = await getRefreshedTokenSetAndClaims(
              token,
              this.client
            );
            await updateToStore(SID, toStore, this.redis);
            req.user = toBrowser;
            if (path === this.refreshPath) {
              if (dev) console.log("/refresh");
              res.end(JSON.stringify(toBrowser));
            }
            userHasValidSession = true;
            if (dev) console.log("Has a valid session");
          } catch (error) {
            if (dev) console.log(error);
            next();
          }
        }

        if (!userHasValidSession) {
          if (path === this.authPath) {
            if (dev) console.log("/auth");
            // We create a state that is saved to the DB and to a cookie, it will be used later
            // to validate that no one stoled the access code.
            const state = generators.state();
            const stateID = uuidv4();
            await this.redis.set(stateID, state, "EX", this.authRequestMaxAge);
            res.setHeader(
              "Set-Cookie",
              serializeCookie("state", String(stateID), {
                httpOnly: true,
                secure: !dev,
                sameSite: true,
                maxAge: this.authRequestMaxAge,
                domain: this.domain,
                path: "/",
              })
            );
            // we then redirect the user to the idp
            const redirectURL = this.client.authorizationUrl({
              scope: this.scope,
              code_challenge_method: "S256",
              state,
            });
            res.redirect(redirectURL);
          } else if (path === this.callbackPath) {
            if (dev) console.log("/cb");
            const params = this.client.callbackParams(req);
            const stateID = parseCookie(req.headers.cookie).state;
            if (stateID === undefined || stateID === "")
              res.redirect(this.authFailedRedirectPath);

            const state = await this.redis.get(stateID);
            try {
              const tokenSet = await this.client.callback(
                this.redirectURI,
                params,
                {
                  state,
                }
              );
              const claimed = tokenSet.claims();
              const resultToStore = { raw: tokenSet, claimed };
              const resultToBrowser = {
                // We don't want the refresh token to be sent to the browser
                raw: {
                  access_token: tokenSet.access_token,
                  id_token: tokenSet.id_token,
                  expires_at: tokenSet.expires_at,
                  scope: tokenSet.scope,
                  token_type: tokenSet.token_type,
                },
                claimed,
              };
              // The user's data are sent to the browser via the sapper middleware
              req.user = resultToBrowser;

              // A session is created and the refresh token is stored.
              const SID = uuidv4();
              try {
                await this.redis.set(
                  SID,
                  JSON.stringify(resultToStore),
                  "EX",
                  this.sessionMaxAge
                );
              } catch (error) {
                res.redirect(this.authFailedRedirectPath);
              }

              res.setHeader(
                "Set-Cookie",
                serializeCookie("SID", String(SID), {
                  httpOnly: true,
                  secure: !dev,
                  sameSite: true,
                  maxAge: this.sessionMaxAge,
                  domain: this.domain,
                  path: "/",
                })
              );
              try {
                await this.redis.del(stateID);
              } catch (error) {
                res.end("Error deleting state from DB");
              }
              res.redirect(this.authSuccessfulRedirectPath);
            } catch (error) {
              res.redirect(this.authFailedRedirectPath);
            }
          } else if (isProtectedPath(path, this.protectedPaths)) {
            if (dev) console.log("protected path");
            res.redirect(this.authPath);
          }
        }
      }
      next();
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
    try {
      const result = await redisClient.get(SID);
      const tokenSet = new TokenSet(JSON.parse(result).raw);
      return tokenSet;
    } catch (error) {
      console.log(error);
      await redisClient.del(SID);
      return undefined;
    }
  } else {
    return undefined;
  }
}

async function getRefreshedTokenSetAndClaims(
  tokenSet: TokenSet,
  client: Client
): Promise<{ toStore: any | undefined; toBrowser: any }> {
  //TODO: Strict type on return;
  const refreshedTokenSet = await client.refresh(tokenSet);
  const claimed = refreshedTokenSet.claims();
  const resultToStore = { raw: refreshedTokenSet, claimed };
  const resultToBrowser = {
    // We don't want the refresh token to be sent to the browser
    raw: {
      access_token: refreshedTokenSet.access_token,
      id_token: refreshedTokenSet.id_token,
      expires_at: refreshedTokenSet.expires_at,
      scope: refreshedTokenSet.scope,
      token_type: refreshedTokenSet.token_type,
    },
    claimed: claimed,
  };
  return {
    toStore: resultToStore,
    toBrowser: resultToBrowser,
  };
}
async function updateToStore(SID: string, toStore: any, redisClient: any) {
  await redisClient.set(SID, JSON.stringify(toStore), "KEEPTTL");
}
