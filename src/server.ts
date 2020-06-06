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
  debug?: boolean;
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
  private debug: boolean;

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
    this.debug = options.debug ? options.debug : false;
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
    this.redis.on("error", function (err: any) {
      console.log("Error " + err);
    });
  }
  middleware() {
    if (!this.ok) throw new Error("Middfleware used before initialization");
    return async (req: any, res: any, next: any) => {
      // we get the current path without any query string
      const path = req.originalUrl.replace(/\?.*$/, "");
      // We don't want our tokens to be refreshed when the browser fetch static files.
      if (this.debug) log(`Request ${path}`);
      if (!path.includes(".") && path !== path.authFailedRedirectPath) {
        if (this.debug)
          log(`doesn't contain a '.' and isn't the 'authFailedRedirectPath'`);

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
        if (this.debug) log(`getting tokens from request if present`);
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
          if (this.debug) log(`has tokens and were successfully retrieved`);
          try {
            if (
              token.expires_at &&
              token.expires_at * 1000 - Date.now() <= 600000
            ) {
              if (this.debug) log(`trying to refresh tokens`);
              const {
                toBrowser,
                toStore,
              } = await getRefreshedTokenSetAndClaims(token, this.client);
              if (this.debug) log(`tokens successfully refreshed`);
              if (this.debug) log(`updating tokens to db`);
              await updateToStore(SID, toStore, this.redis);
              if (this.debug) log(`tokens successfully saved`);
              req.user = toBrowser;
              if (path === this.refreshPath) {
                if (this.debug) log(`is a refresh request`);
                res.end(JSON.stringify(toBrowser));
                if (this.debug) log(`tokens sent to frontend`);
                if (this.debug) log(`end of request`);
              } else if (path === this.callbackPath) {
                res.redirect(this.authSuccessfulRedirectPath);
                if (this.debug) log(`end of request`);
              }
            } else {
              const toBrowser = {
                // We don't want the refresh token to be sent to the browser
                raw: {
                  access_token: token.access_token,
                  id_token: token.id_token,
                  expires_at: token.expires_at,
                  scope: token.scope,
                  token_type: token.token_type,
                },
                claimed: token.claims(),
              };
              req.user = toBrowser;
              if (path === this.refreshPath) {
                if (this.debug) log(`is a refresh request`);
                res.end(JSON.stringify(toBrowser));
                if (this.debug) log(`tokens sent to frontend`);
                if (this.debug) log(`end of request`);
              } else if (path === this.callbackPath) {
                res.redirect(this.authSuccessfulRedirectPath);
                if (this.debug) log(`end of request`);
              }
            }
            userHasValidSession = true;
          } catch (error) {
            if (this.debug) console.log(error);
          }
        }

        if (!userHasValidSession) {
          if (this.debug) log(`doesn't have a valid session`);
          if (path === this.authPath && req.method == "POST") {
            if (this.debug) log(`request is the auth path`);
            // We create a state that is saved to the DB and to a cookie, it will be used later
            // to validate that no one stoled the access code.
            const state = generators.state();
            const stateID = req.body.stateID;
            if (this.debug) log(`generating and saving state to db`);
            await this.redis.set(stateID, state, "EX", this.authRequestMaxAge);
            if (this.debug) log(`creating state cookie`);

            if (this.debug) log(`authUrl is being built`);
            // we then redirect the user to the idp
            const redirectURL = this.client.authorizationUrl({
              scope: this.scope,
              code_challenge_method: "S256",
              state,
            });
            if (this.debug) log(`redirect user to idp`);
            if (this.debug) log(`end of request`);
            res.end(JSON.stringify({ url: redirectURL }));
          } else if (path === this.callbackPath && req.method == "POST") {
            if (this.debug) log(`request is the callback path`);
            if (this.debug) log(`getting params from callback query`);
            const params = this.client.callbackParams(req.originalUrl);
            if (this.debug) log(`parsing cookie state`);
            const stateID = req.body.stateID;
            if (stateID === undefined || stateID === "") {
              if (this.debug)
                log(`no state found in cookie/no cookie named state`);
              res.redirect(this.authFailedRedirectPath);
            } else {
              if (this.debug) log(`getting state from db`);
              const state = await this.redis.get(stateID);
              try {
                if (this.debug) log(`getting tokenset from auth`);
                const tokenSet = await this.client.callback(
                  this.redirectURI,
                  params,
                  {
                    state,
                  }
                );
                if (this.debug) log(`getting token claims`);
                const claimed = tokenSet.claims();
                const resultToStore = { raw: tokenSet, claimed };
                // The user's data are sent to the browser via the sapper middleware
                if (this.debug) log(`creating SID in redis`);
                // A session is created and the refresh token is stored.
                const SID = uuidv4();
                try {
                  await this.redis.set(
                    String(SID),
                    JSON.stringify(resultToStore),
                    "EX",
                    this.sessionMaxAge
                  );
                } catch (error) {
                  console.log(error);
                  res.redirect(this.authFailedRedirectPath);
                }
                if (this.debug) log(`creating SID cookie`);
                res.setHeader(
                  "Set-Cookie",
                  serializeCookie("SID", String(SID), {
                    httpOnly: !dev,
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
                if (this.debug) log(`end`);
                res.end(
                  JSON.stringify({ url: this.authSuccessfulRedirectPath })
                );
              } catch (error) {
                res.redirect(this.authFailedRedirectPath);
              }
            }
          } else if (isProtectedPath(path, this.protectedPaths)) {
            if (this.debug) log(`request is a protected path`);
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

function log(message: string) {
  console.log("\x1b[36m%s\x1b[0m", "[sapper-oidc]", "\x1b[0m", message);
}
