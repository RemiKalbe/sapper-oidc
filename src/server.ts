import {
  Issuer,
  generators,
  Client,
  ResponseType,
  TokenSet,
} from "openid-client";
import { createNodeRedisClient } from 'handy-redis';
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
  silentRedirectURI?: string;
  sessionMaxAge: number;
  authRequestMaxAge: number;
  authPath: string;
  protectedPaths: ProtectedPath[];
  authSuccessfulRedirectPath: string;
  callbackPath: string;
  silentCallbackPath?: string;
  silentPath?: string;
  scope: string;
  refreshPath: string;
  redisURL?: string;
  debug?: boolean;
}

export class SapperOIDCClient {
  private clientID: string;
  private clientSecret: string;
  private redirectURI: string;
  private silentRedirectURI?: string;
  private responseTypes: ResponseType[];
  private sessionMaxAge: number;
  private authRequestMaxAge: number;
  private issuerURL: string;
  private client!: Client;
  private redis: any;
  private authPath: string;
  private protectedPaths: ProtectedPath[];
  private callbackPath: string;
  private silentCallbackPath?: string;
  private authSuccessfulRedirectPath: string;
  private refreshPath: string;
  private silentPath?: string;
  private scope: string;
  private ok!: boolean;
  private debug: boolean;

  constructor(options: Options) {
    this.clientID = options.clientID;
    this.clientSecret = options.clientSecret;
    this.redirectURI = options.redirectURI;
    this.silentRedirectURI = options.silentRedirectURI
      ? options.silentRedirectURI
      : undefined;
    this.responseTypes = ["code"];
    this.issuerURL = options.issuerURL;
    this.sessionMaxAge = options.sessionMaxAge;
    this.authRequestMaxAge = options.authRequestMaxAge;
    this.redis = options.redisURL
      ? createNodeRedisClient({ url: options.redisURL })
      : createNodeRedisClient();
    this.authPath = options.authPath;
    this.protectedPaths = options.protectedPaths;
    this.callbackPath = options.callbackPath;
    this.silentCallbackPath = options.silentCallbackPath;
    this.authSuccessfulRedirectPath = options.authSuccessfulRedirectPath;
    this.refreshPath = options.refreshPath;
    this.silentPath = options.silentPath ? options.silentPath : undefined;
    this.scope = options.scope;
    this.debug = options.debug ? options.debug : false;
  }
  async init() {
    const discoveredIssuer = await Issuer.discover(this.issuerURL).catch((err) => {
      log("Unable to dicover issuer");
      throw new Error(err);
    });
    let redirect_uris = [this.redirectURI];
    if (this.silentRedirectURI) redirect_uris.push(this.silentRedirectURI);
    this.client = new discoveredIssuer.Client({
      client_id: this.clientID,
      client_secret: this.clientSecret,
      redirect_uris,
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
      // We get the current path without any query string
      const path = req.originalUrl.replace(/\?.*$/, "");
      // We don't want our tokens to be refreshed when the browser fetch static files.
      if (!path.includes(".") && path !== "__sapper__") {
        // Polka doesn't have res.redirect
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
        // if a session exist, we get the token set
        const token = await getTokenSetFromCookie(req, this.redis);
        const SID = getSIDFromCookie(req);
        if (
          token !== undefined &&
          token !== null &&
          SID !== undefined &&
          SID !== null
        ) {
          try {
            // Is the token going to expire in 10min or less?
            if (
              token.expires_at &&
              token.expires_at * 1000 - Date.now() <= 600000
            ) {
              const result = await getRefreshedTokenSetAndClaims(
                token,
                this.client
              );
              if (result) {
                const { toBrowser, toStore } = result;
                await updateToStore(SID, toStore, this.redis);

                if (path === this.refreshPath) {
                  res.end(JSON.stringify(toBrowser));
                } else if (path === this.callbackPath) {
                  res.redirect(this.authSuccessfulRedirectPath);
                } else {
                  req.user = toBrowser;
                }
              } else {
                this.redis.del(SID);
              }
            } else {
              try {
                const claimed = token.claims();
                const toBrowser = {
                  // We don't want the refresh token to be sent to the browser
                  raw: {
                    access_token: token.access_token,
                    id_token: token.id_token,
                    expires_at: token.expires_at,
                    scope: token.scope,
                    token_type: token.token_type,
                  },
                  claimed,
                };

                if (path === this.refreshPath) {
                  res.end(JSON.stringify(toBrowser));
                } else if (path === this.callbackPath) {
                  res.redirect(this.authSuccessfulRedirectPath);
                } else {
                  req.user = toBrowser;
                }
              } catch (error) {
                this.redis.del(SID);
                log(
                  "Error: We were not able to get the data from the token (claims)"
                );
              }
            }
            userHasValidSession = true;
          } catch (error) {
            this.redis.del(SID);
            log("Unknow error:");
            console.log(error);
          }
        }
        if (!userHasValidSession) {
          if (path === this.authPath && req.method == "POST") {
            // Get get a StateID from the frontend, generate a state and store
            // it in the db, it will be used later to validate that no one stoled the access code.
            const state = generators.state();
            const stateID = req.query.stateID;
            if (stateID) {
              try {
                await this.redis.set(
                  stateID,
                  state,
                  "EX",
                  this.authRequestMaxAge
                );
              } catch (error) {
                log(
                  "Error: We were not able to store the state in the DB, check the following logs from redis:"
                );
                console.log(error);
                res.end(JSON.stringify({ err: "DB_ERR" }));
              }
              // We then send the redirect URL back to the frontend, the frontend will
              // take care of redirecting the user to the idp.
              try {
                const redirectURL = this.client.authorizationUrl({
                  scope: this.scope,
                  //code_challenge_method: "S256",
                  redirect_uri: this.redirectURI,
                  state,
                });
                res.end(JSON.stringify({ url: redirectURL }));
              } catch (error) {
                log(
                  "Error: We were not able to generate the authorization url, check the following logs:"
                );
                console.log(error);
                res.end(JSON.stringify({ err: "AUTH_URL_ERR" }));
              }
            } else {
              log("Error: No stateID found in request");
              res.end(JSON.stringify({ err: "NO_STATEID_FOUND_IN_REQ" }));
            }
          } else if (
            (path === this.callbackPath || path === this.silentCallbackPath) &&
            req.method == "POST"
          ) {
            try {
              const params = this.client.callbackParams(req.originalUrl);
              try {
                const stateID: String = req.query.stateID;
                if (
                  stateID === null ||
                  stateID === undefined ||
                  stateID === ""
                ) {
                  log("Error: No state found");
                  res.end(JSON.stringify({ err: "NO_STATE_FOUND_IN_REQ" }));
                } else {
                  try {
                    const state = await this.redis.get(stateID);
                    if (state) {
                      try {
                        const tokenSet = await this.client.callback(
                          path === this.callbackPath
                            ? this.redirectURI
                            : this.silentRedirectURI,
                          params,
                          {
                            state,
                          }
                        );
                        try {
                          const claimed = tokenSet.claims();
                          const resultToStore = { raw: tokenSet, claimed };
                          const toBrowser = {
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
                          const SID = uuidv4();
                          // We create the user's session
                          try {
                            await this.redis.set(
                              String(SID),
                              JSON.stringify(resultToStore),
                              "EX",
                              this.sessionMaxAge
                            );
                            res.setHeader(
                              "Set-Cookie",
                              serializeCookie("SID", String(SID), {
                                httpOnly: !dev,
                                secure: !dev,
                                sameSite: true,
                                maxAge: this.sessionMaxAge,
                                path: "/",
                              })
                            );
                            try {
                              await this.redis.del(stateID);
                            } catch (error) {
                              log(
                                "Error: We were not able to delete the state from the DB, see the following logs:"
                              );
                              console.log(error);
                              res.end(JSON.stringify({ err: "DB_ERR" }));
                            }
                            if (path !== this.silentCallbackPath) {
                              res.end(
                                JSON.stringify({
                                  url: this.authSuccessfulRedirectPath,
                                })
                              );
                            } else {
                              res.end(JSON.stringify(toBrowser));
                            }
                          } catch (error) {
                            log(
                              "Error: We were not able to save the session to the db, check the following logs:"
                            );
                            console.log(error);
                            res.end(JSON.stringify({ err: "DB_ERR" }));
                          }
                        } catch (error) {
                          log(
                            "Error: We were not able to claims the tokens, see the following logs:"
                          );
                          console.log(error);
                          res.end(JSON.stringify({ err: "CLAIMS_ERR" }));
                        }
                      } catch (error) {
                        log(
                          "Error: We were not able to perform the callback for Authorization Server's authorization response, see the logs bellow:"
                        );
                        console.log(error);
                        res.end(
                          JSON.stringify({
                            err: "CALLBACK_ERR",
                            op_err: error.error,
                          })
                        );
                      }
                    } else {
                      log("Error: No state found in db");
                      res.end(JSON.stringify({ err: "NO_STATE_FOUND_IN_DB" }));
                    }
                  } catch (error) {
                    log(
                      "Error: An error occured when fetching the state from the DB, see the error bellow:"
                    );
                    console.log(error);
                    res.end(JSON.stringify({ err: "DB_ERR" }));
                  }
                }
              } catch (error) {
                log(
                  "Error: body is undefined, have you forgot bodyParser middleware?"
                );
              }
            } catch (error) {
              log(
                "Error: We were not able to get the params from the callback, see the following logs:"
              );
              console.log(error);
              res.end(JSON.stringify({ err: "NO_PARAMS_FOUND" }));
            }
          } else if (
            this.silentPath &&
            path !== this.silentPath &&
            path !== this.authPath &&
            path !== this.callbackPath &&
            this.silentRedirectURI &&
            path !== this.silentCallbackPath
          ) {
            const state = generators.state();
            const stateID = uuidv4();
            await this.redis.set(stateID, state);
            const redirectURL = `${this.client.authorizationUrl({
              scope: this.scope,
              //code_challenge_method: "S256",
              state,
              redirect_uri: this.silentRedirectURI,
            })}&prompt=none`;
            // To avoid any issues with the queries inside other queries we encode the two URLs in base64
            const buffRedirectTo = new Buffer(redirectURL);
            const base64RedirectTo = buffRedirectTo.toString("base64");
            const where_at = req.originalUrl;
            const buffWhere_at = new Buffer(where_at);
            const base64Where_at = buffWhere_at.toString("base64");
            console.log(where_at);
            res.redirect(
              `${this.silentPath}?redirect_to=${base64RedirectTo}&stateID=${stateID}&where_at=${base64Where_at}`
            );
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
      if (result) {
        try {
          const tokenSet = new TokenSet(JSON.parse(result).raw);
          return tokenSet;
        } catch (error) {
          // It would mean that the data stored in the DB are not correctly formated. We don't want that.
          await redisClient.del(SID);
          return undefined;
        }
      } else {
        return undefined;
      }
    } catch (error) {
      return undefined;
    }
  } else {
    return undefined;
  }
}

async function getRefreshedTokenSetAndClaims(
  tokenSet: TokenSet,
  client: Client
): Promise<{ toStore: any; toBrowser: any } | undefined> {
  //TODO: Strict type on return;
  try {
    const refreshedTokenSet = await client.refresh(tokenSet);
    try {
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
    } catch (error) {
      log("Error: We were not able to get the data from the token (claims)");
      return undefined;
    }
  } catch (error) {
    log("Error: We were not able to refresh the tokens");
    return undefined;
  }
}

async function updateToStore(SID: string, toStore: any, redisClient: any) {
  await redisClient.set(SID, JSON.stringify(toStore), "KEEPTTL");
}

function log(message: string) {
  console.log("\x1b[36m%s\x1b[0m", "[sapper-oidc]", "\x1b[0m", message);
}
