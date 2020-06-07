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
  debug?: boolean;
}

export class SapperOIDCClient {
  private clientID: string;
  private clientSecret: string;
  private redirectURI: string;
  private responseTypes: [ResponseType];
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
      // We get the current path without any query string
      const path = req.originalUrl.replace(/\?.*$/, "");
      // We don't want our tokens to be refreshed when the browser fetch static files.
      if (!path.includes(".")) {
        // Polka doesn't have res.redirect
        res.redirect = (location: string) => {
          res.end(
            `<meta http-equiv="refresh" content="0;URL=${
              req.headers.origin ? req.headers.origin : "" + location
            }">`
          );
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
                log(
                  "Error: We were not able to get the data from the token (claims)"
                );
              }
            }
            userHasValidSession = true;
          } catch (error) {
            log("Unknow error:");
            console.log(error);
          }
        }
        if (!userHasValidSession) {
          if (path === this.authPath) {
            // Generate a state and store it in the db & in a cookie, it will be used later to
            // validate that the response hasn't been tempered with.
            const state = generators.state();
            const stateID = uuidv4();

            res.setHeader(
              "Set-Cookie",
              serializeCookie("state", String(stateID), {
                httpOnly: !dev,
                secure: !dev,
                sameSite: true,
                maxAge: this.authRequestMaxAge,
                path: "/",
              })
            );

            try {
              await this.redis.set(
                stateID,
                state,
                "EX",
                this.authRequestMaxAge
              );
              // We then redirect the user to the authorization page.
              try {
                const redirectURL = this.client.authorizationUrl({
                  scope: this.scope,
                  code_challenge_method: "S256",
                  state,
                });
                res.redirect(redirectURL);
              } catch (error) {
                log(
                  "Error: We were not able to generate the authorization url, check the following logs:"
                );
                console.log(error);
                req.error = "AUTH_URL_ERR";
              }
            } catch (error) {
              log(
                "Error: We were not able to store the state in the DB, check the following logs from redis:"
              );
              console.log(error);
              req.error = "DB_ERR";
            }
          } else if (path === this.callbackPath) {
            try {
              const params = this.client.callbackParams(req);
              const stateID = getStateFromCookie(req);
              if (stateID === null || stateID === undefined || stateID === "") {
                log("Error: No state found");
                req.error = "NO_STATE_FOUND_IN_REQ";
                res.redirect(this.authFailedRedirectPath);
              } else {
                try {
                  const state = await this.redis.get(stateID);
                  if (state) {
                    try {
                      const tokenSet = await this.client.callback(
                        this.redirectURI,
                        params,
                        {
                          state,
                        }
                      );
                      try {
                        const claimed = tokenSet.claims();
                        const resultToStore = { raw: tokenSet, claimed };
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
                            req.error = "DB_ERR";
                            res.redirect(this.authFailedRedirectPath);
                          }
                          // TODO: Redirect back.
                          res.redirect(this.authSuccessfulRedirectPath);
                        } catch (error) {
                          log(
                            "Error: We were not able to save the session to the db, check the following logs:"
                          );
                          console.log(error);
                          req.error = "DB_ERR";
                          res.redirect(this.authFailedRedirectPath);
                        }
                      } catch (error) {
                        log(
                          "Error: We were not able to claims the tokens, see the following logs:"
                        );
                        console.log(error);
                        req.error = "CLAIMS_ERR";
                        res.redirect(this.authFailedRedirectPath);
                      }
                    } catch (error) {
                      log(
                        "Error: We were not able to perform the callback for Authorization Server's authorization response, see the logs bellow:"
                      );
                      console.log(error);
                      req.error = "CALLBACK_ERR";
                      res.redirect(this.authFailedRedirectPath);
                    }
                  } else {
                    log("Error: No state found in db");
                    req.error = "NO_STATE_FOUND_IN_DB";
                    res.redirect(this.authFailedRedirectPath);
                  }
                } catch (error) {
                  log(
                    "Error: An error occured when fetching the state from the DB, see the error bellow:"
                  );
                  console.log(error);
                  req.error = "DB_ERR";
                  res.redirect(this.authFailedRedirectPath);
                }
              }
            } catch (error) {
              log(
                "Error: We were not able to get the params from the callback, see the following logs:"
              );
              console.log(error);
              req.error = "NO_PARAMS_FOUND";
              res.redirect(this.authFailedRedirectPath);
            }
          } else if (isProtectedPath(path, this.protectedPaths)) {
            // TODO: Not redirect?
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

function getStateFromCookie(req: any): string | undefined {
  return req.headers.cookie ? parseCookie(req.headers.cookie).state : undefined;
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
