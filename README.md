![logo of the package](https://i.imgur.com/Pv05YSp.png)

# Sapper OIDC

This library is based on top of [node-openid-client](https://github.com/panva/node-openid-client) and allow you to quickly and effortlessly add OIDC to your sapper application. <br>

## Introduction

More and more browsers are starting to block third party cookies by default, and chrome will too in ~2022. Meaning any type of secure client-side authentication is dead if your identity provider is at a different domain, which is probably the case. <br>
This library is a way to solve this issue by using sapper as a sort of proxy. <br>

## Limitation

- You can only have one identity provider.
- You can only use Redis as the session store, and it must be >= v6.0.
- Route with a "." will be ignored.

## Installation

🚧🚧🚧 IMPORTANT 🚧🚧🚧<br>
This project is in very early developpement, breaking changes, unhandled promise rejection and other great bugs are to be excepted until it reach v1.0.<br> <br>

```bash
npm i sapper-oidc body-parser
```

### Create a confirguration file

in your `/src` create a file, for example named `OIDCConfig.js` and add the following:

```js
export const authPath = "/auth"; // This route initiate the OIDC flow.
export const refreshPath = "/refresh"; // This is the route that will be called when tokens need to be refreshed
export const protectedPaths = [
  // This array stores all routes where the user MUST be logged in, if he is not he will be redirected to the identity provider.
  {
    path: "/private-info",
    recursive: true /* This means that all route starting with /private-info requires the user to be logged in*/,
  },
  {
    path: "/privateOnlyHere",
    recursive: false /* This means that only /privateOnlyHere requires the user to be logged in, /privateOnlyHere/1234569 doesn't require the user to be logged in*/,
  },
];
```

### Server side configuration

You need to wrap all your code in an immediately invoked async function<br>
server.js

```js
import { authPath, refreshPath, protectedPaths } from "./OIDCConfig"; // The file we just created
import { SapperOIDCClient } from "sapper-oidc/lib/server";
import bodyParser from "body-parser";

(async function () {
  const options = {
    issuerURL: "https://accounts.google.com/", // See your identity provider documentation
    clientID: "8db8f07d-547d-4e8b-8d8b-218fc08b7188",
    clientSecret: "3nxeS5K3mFe.5Hv7Gvjp6xUWq~",
    redirectURI: "http://127.0.0.1:3000/cb", // This is the URL the idp will redirect the user to. It must be the callback route that you will define bellow.
    sessionMaxAge: 60 * 60 * 24 * 7, // How long does a user's session lives for (in seconds)
    authRequestMaxAge: 60 * 60, // How much time before an auth request is deemed invalid (in seconds).
    authPath,
    refreshPath,
    protectedPaths,
    authSuccessfulRedirectPath: "http://127.0.0.1:3000/", // Where do you want the user to be redirected to upon successful auth
    authFailedRedirectPath: "http://127.0.0.1:3000/error", // Where do you want the user to be redirected to upon failed auth
    callbackPath: "/cb", // The route of the callback
    scope: "openid profile offline_access", // You must have at least openid and offline_access
    redisURL: "", // The URL of the Redis server. Format: [redis[s]:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]] (More info avaliable at IANA).
    // It default to: 127.0.0.1:6379 with no password
  };
  const client = new SapperOIDCClient(options);
  await client.init(); // Don't forget it 🚦

  polka()
    .use(bodyParser.json()) // Don't forget that 🚦
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
```

### Client side configuration

Here we will set up the automatic token refresh, and I'll explain a little bit about how to get the user's data.
Open your root `_layout.svelte` (or create one)

```svelte
<script context="module">
  export async function preload(page, session) {
    return session;
  }
</script>

<script>
  import { onMount } from "svelte";
  import { stores } from "@sapper/app";
  import { silentRenew, pathGuard } from "sapper-oidc/lib/client";
  import { authPath, refreshPath, protectedPaths } from "../OIDCConfig";
  const { page } = stores();

  export let user;

  $: {
    if (user) {
      console.log(user); // You can see what data you get 👩‍🔬
    }
  }
  onMount(async () => {
    /* You can see the callback function assign "e" to "user",
        "e" is the data returned when a token is refreshed, it is
        the same structure as "user" returned before */
    await silentRenew(refreshPath, e => (user = e), user);
    page.subscribe(({ path }) => {
      /* If a user navigate client side to a route that you
            configured to be available only to logged in user,
            pathGuard will ensure that. */
      pathGuard(authPath, path, protectedPaths, user);
    });
  });
</script>
```

I'd recommend that you create a Svelte store to store the data you get back from "user", and then you update it with the new data that you get from the callback function in "silentRenew". <br>
Finaly create a svelte file with the SAME path as your `callbackPath` set in the options. <br>
For example, if your path is "/cb" create a svelte file at the root of the routes folder named `cb.svelte`.<br>
cb.svelte

```svelte
<script>
  import { onMount } from "svelte";
  import { callback } from "sapper-oidc/lib/client";

  onMount( () => {
    try {
      callback();
    }catch (error){
      // Do something here
    }
  });
</script>

```

And done 😇
