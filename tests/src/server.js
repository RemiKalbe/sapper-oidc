import sirv from "sirv";
import polka from "polka";
import compression from "compression";
import * as sapper from "@sapper/server";
import { authPath, refreshPath, protectedPaths } from "./OIDCConfig"; // The file we just created
import { SapperOIDCClient } from "sapper-oidc/lib/server";

const { PORT, NODE_ENV, ISSUER_URL, CLIENT_ID, CLIENT_SECRET } = process.env;
const dev = NODE_ENV === "development";

(async function () {
  const options = {
    issuerURL: "http://localhost:4444", // See your identity provider documentation
    clientID: "client-id",
    clientSecret: "client-secret",
    redirectURI: "http://localhost:3001/cb", // This is the URL the idp will redirect the user to. It must be the callback route that you will define bellow.
    silentRedirectURI: "http://localhost:3001/silentcb",
    sessionMaxAge: 60 * 60 * 24 * 7, // How long does a user's session lives for (in seconds)
    authRequestMaxAge: 60 * 60, // How much time before an auth request is deemed invalid (in seconds).
    authPath,
    refreshPath,
    protectedPaths,
    /* Where do you want the user to be redirected to upon successful auth
		Except if you set at the callback route to redirect the user back to
		where he was before */
    authSuccessfulRedirectPath: "/",
    callbackPath: "/cb", // The route of the callback
    silentCallbackPath: "/silentcb",
    silentPath: "/silent",
    scope: "openid profile offline", // You must have at least openid and offline_access
    redisURL: "", // The URL of the Redis server. Format: [redis[s]:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]] (More info avaliable at IANA).
    // It default to: 127.0.0.1:6379 with no password
  };
  const client = new SapperOIDCClient(options);
  await client.init(); // Don't forget it 🚦

  polka()
    .use(await client.middleware()) // Don't forget that 🚦
    .use(
      compression({ threshold: 0 }),
      sirv("static", { dev }),
      sapper.middleware({
        session: (req, res) => ({
          // And finally 🚦
          user: req.user,
        }),
      })
    )
    .listen(PORT, (err) => {
      if (err) console.log("error", err);
    });
})();
