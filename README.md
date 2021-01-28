![logo of the package](https://i.imgur.com/Pv05YSp.png)

# Sapper OIDC [![Build Status](https://dev.azure.com/remikalbe0563/sapper-oidc/_apis/build/status/RemiKalbe.sapper-oidc?branchName=master)](https://dev.azure.com/remikalbe0563/sapper-oidc/_build/latest?definitionId=1&branchName=master) ![CodeQL](https://github.com/RemiKalbe/sapper-oidc/workflows/CodeQL/badge.svg)

This library is based on top of [node-openid-client](https://github.com/panva/node-openid-client) and allow you to quickly and effortlessly add OIDC to your sapper application. It is first meant to be used in a first-party scenario where you are the owner of the IDP (i.e you use Okta, Auth0, IdentityServer, Ory Hydra...); That being said, it works with anything that follows the open id connect specification.<br><br>
🧪 Please note that this library is experimental and I wouldn't recommend you to use it in production for now.<br><br>
It has the following features<br>

- 👮‍♀️ Page protection (Will redirect the user to login, if on a page set to be protected)
- 🚴‍♂️ Automatic token refresh on the frontend and backend (without using an iframe)
- 🗄 Session management
- ↪️ Automatic redirection back to where the user was before the auth flow initiated.
- 🔮 Silent login if the user already has a session at the IDP (without using an iframe)

## Todo

- [ ] Add a way to logout
- [ ] Add a way to login programmatically (right now it logs you in only if you navigate on a protected path or if you enable silent login)
- [ ] Support older versions of redis
- [ ] Less boilerplate

## Limitation

- You can only have one identity provider.
- You can only use Redis as the session store, and it must be >= v6.0.
- Route with a "." will be ignored.

## Installation

You have two way of installing this library.

### Method 1

Install https://www.npmjs.com/package/rollup-plugin-node-externals (`node-externals` can mess up some libraries, if you have issues after installing `node-externals` use method 2<br>
and https://www.npmjs.com/package/@rollup/plugin-json<br><br>
`rollup.config.js`

```js
import externals from "rollup-plugin-node-externals";
import json from "@rollup/plugin-json";

export default {
    ......
    server: {
        ......
        /* IMPORTANT, externals() needs to be at
        the top of the plugins array*/
        plugins: [externals(), json()]
        ......
    }
    ......
}
```

```bash
npm i --save-dev sapper-oidc
npm i redis
```

### Method 2

Install https://www.npmjs.com/package/@rollup/plugin-json<br><br>
`rollup.config.js`

```js
import json from "@rollup/plugin-json";

export default {
    ......
    server: {
        ......
        plugins: [... json() ...]
        ......
    }
    ......
}
```

```bash
npm i --save-dev sapper-oidc
npm i redis
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
`server.js`

```js
import { authPath, refreshPath, protectedPaths } from "./OIDCConfig"; // The file we just created
import { SapperOIDCClient } from "sapper-oidc/lib/server";

(async function () {
  const options = {
    issuerURL: "https://accounts.google.com/", // See your identity provider documentation
    clientID: "8db8f07d-547d-4e8b-8d8b-218fc08b7188",
    clientSecret: "3nxeS5K3mFe.5Hv7Gvjp6xUWq~",
    redirectURI: "http://127.0.0.1:3000/cb", // This is the URL the idp will redirect the user to. It must be the callback route that you will define bellow; you must add this url to your IDP authorized redirect URI.
    silentRedirectURI: "http://localhost:3001/silentcb", // (OPTIONAL) This is the callback URL if you want to silently login the user, you must add this URL to your IDP authorized redirect URI if you add this line.
    sessionMaxAge: 60 * 60 * 24 * 7, // How long does a user's session lives for (in seconds)
    authRequestMaxAge: 60 * 60, // How much time before an auth request is deemed invalid (in seconds).
    authPath,
    refreshPath,
    protectedPaths,
    /* Where do you want the user to be redirected to upon successful auth
      Except if you set at the callback route to redirect the user back to
      where he was before */
    authSuccessfulRedirectPath: "http://127.0.0.1:3000/",
    callbackPath: "/cb", // The route of the callback
    silentCallbackPath: "/silentcb", // (OPTIONAL) The route of the silent callback, adds this line only if you have added 'silentRedirectURI' and as I already said, the paths MUST match.
    scope: "openid profile offline_access", // You must have at least openid and offline_access
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
      try {
        pathGuard(authPath, path, protectedPaths, user);
      }catch (error){
      // See the error section for more details
      }
    });
  });
</script>
```

I'd recommend that you create a Svelte store to store the data you get back from "user", and then you update it with the new data that you get from the callback function in "silentRenew". <br>
Now create a svelte file with the SAME path as your `callbackPath` set in the options. <br>
For example, if your path is "/cb" create a svelte file at the root of the routes folder named `cb.svelte`.<br>
`cb.svelte`

```svelte
<script>
  import { onMount } from "svelte";
  import { callback } from "sapper-oidc/lib/client";

  onMount( () => {
    try {
      callback(true); // If true, the user will be redirected back to where he was before.
    }catch (error){
      // See the error section for more details
    }
  });
</script>
```

Finaly create a svelte file with the SAME path as your `authPath` set in the options. <br>
For example, if your path is "/auth" create a svelte file at the root of the routes folder named `auth.svelte`.<br>
`auth.svelte`

```svelte
<script>
  import { onMount } from "svelte";
  import { auth } from "sapper-oidc/lib/client";
  import { authPath } from "../OIDCConfig";

  onMount(() => {
    try {
      auth(authPath);
    } catch (error) {
      console.log(error);
    }
  });
</script>
```

And done 😇<br><br>

### OPTIONAL

If you've added `silentRedirectURI` and `silentCallbackPath` you must add one thing.<br>
Create a svelte file that has the same path as `silentCallbackPath`, example, if `silentCallbackPath` is set to `/silentcb` create a svelte file at the root of your routes folder like so `silentcb.svelte`.<br>
`silentcb.svelte`

```svelte
<script>
  import { onMount } from "svelte";
  import { silentCallback, silentRenew } from "sapper-oidc/lib/client";
  import { refreshPath } from "../OIDCConfig";
  import { goto } from "@sapper/app";

  onMount(() => {
    try {
      silentCallback(goto, async (user) => {
        /* Do the same thing here as you where doing with _layout.svelte
          which is saving the data you get back to the same store.*/
          await silentRenew(
          refreshPath,
          (e) => {
            // Do it also here
          },
          user
        );
      });
    } catch (error) {
      // As this is supposed to be something 'silent' the only error that could be thrown is if the library failed to fetch the server.
    }
  });
</script>

```

### Errors

#### From `pathGuard`

| Name                    | Info                                               |
| ----------------------- | -------------------------------------------------- |
| DB_ERR                  | An unexpected error from redis                     |
| AUTH_URL_ERR            | It were not able to generate the authorization url |
| NO_STATEID_FOUND_IN_REQ | There wasn't any stateID sent with the request     |

#### From `callback`

| Name                  | Info                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| NO_STATE_FOUND_IN_REQ | There wasn't any state sent with the request                                               |
| NO_STATE_FOUND_IN_STR | No state found in storage (meaning localStorage is empty)                                  |
| DB_ERR                | An unexpected error from redis                                                             |
| CLAIMS_ERR            | It were not able to claims the tokens (ie: get the user's info)                            |
| CALLBACK_ERR          | It were not able to perform the callback for Authorization Server's authorization response |
| NO_STATE_FOUND_IN_DB  | There wasn't any state corresponding to the stateID sent with the request in the DB        |
| NO_PARAMS_FOUND       | The request didn't had any params                                                          |
