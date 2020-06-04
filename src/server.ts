import { Issuer, generators, Client, ResponseType } from "openid-client";
import redis from "async-redis";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { v4 as uuidv4 } from "uuid";

const { NODE_ENV } = process.env;
const dev = NODE_ENV === "development";

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

  constructor(
    issuerURL: string,
    clientID: string,
    clientSecret: string,
    redirectURI: string,
    sessionMaxAge: number,
    authRequestMaxAge: number,
    authPath: string,
    protectedPath: string,
    authSuccessfulRedirectPath: string,
    authFailedRedirectPath: string,
    callbackPath: string,
    scope: string,
    refreshPath: string,
    redisOption: {
      host?: string;
      port?: number;
      path?: string;
      password?: string;
      family?: string;
      tls?: any;
    },
    domain?: string
  ) {
    this.clientID = clientID;
    this.clientSecret = clientSecret;
    this.redirectURI = redirectURI;
    this.responseTypes = ["code"];
    this.issuerURL = issuerURL;
    this.sessionMaxAge = sessionMaxAge;
    this.authRequestMaxAge = authRequestMaxAge;
    this.redis = redis.createClient(redisOption);
    this.authPath = authPath;
    this.protectedPath = protectedPath;
    this.callbackPath = callbackPath;
    this.authSuccessfulRedirectPath = authSuccessfulRedirectPath;
    this.authFailedRedirectPath = authFailedRedirectPath;
    this.refreshPath = refreshPath;
    this.domain = domain ? domain : "";
    this.scope = scope;
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
    if (typeof window === "undefined") {
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

        if (path === this.protectedPath) {
          // We check if the user already has a session
          try {
            const session = parseCookie(req.headers.cookie).SID;
            const user = await this.redis.get(session);
            req.user = JSON.parse(user);
          } catch (error) {
            console.log(error);
          }
          next();
        } else if (path === this.authPath) {
          const state = generators.state();
          const stateID = uuidv4();
          await this.redis.set(stateID, state, "EX", this.authRequestMaxAge);
          res.setHeader(
            "Set-Cookie",
            serializeCookie("state", String(stateID), {
              httpOnly: true,
              secure: !dev,
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
                maxAge: this.sessionMaxAge,
                domain: this.domain,
                path: "/",
              }),
              serializeCookie("state", "", {
                httpOnly: true,
                secure: !dev,
                maxAge: 1,
                domain: this.domain,
                path: "/",
              }),
            ]);
            await this.redis.del(stateID);
            res.redirect(this.authSuccessfulRedirectPath);
          } catch (error) {
            console.log(error);
            res.redirect(this.authFailedRedirectPath);
          }
        } else if (path === this.refreshPath) {
          const SID = parseCookie(req.headers.cookie).SID;
          if (SID) {
            const tokenSet = this.redis.get(SID).raw;
            const refreshedTokenSet = await this.client.refresh(tokenSet);
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
            await this.redis.set(SID, JSON.stringify(resultToStore), "KEEPTTL");
            res.send(resultToBrowser);
          }
        } else {
          next();
        }
      };
    }
  }
}
