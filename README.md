![logo of the package](https://i.imgur.com/Pv05YSp.png)
# Sapper OIDC
This library is based on top of [node-openid-client](https://github.com/panva/node-openid-client) and allow you to quickly and effortlessly add OIDC to your sapper application. <br>
## Introduction
More and more browsers are starting to block third party cookies by default, and chrome will too in ~2022. Meaning any type of secure client-side authentication is dead if your identity provider is at a different domain, which is probably the case. <br>
This library is a way to solve this issue by using the sapper server as a sort of proxy (sort of). <br>
## Installation
🚧🚧🚧 IMPORTANT 🚧🚧🚧
This project is in very early developpement, breaking changes, unhandled promise rejection and other great bugs are to be excepted until we reach v1.0.<br> <br>
```bash
npm i sapper-oidc
```
### Server side configuration

You need to wrap all your code in an immediately invoked async function

```js
(async function () {
  import { SapperOIDCClient } from "sapper-oidc/lib/server";
  const client = new SapperOIDCClient();
  await client.init();

  polka()
    .use(await client.middleware())
    .use(
      compression({ threshold: 0 }),
      sirv("static", { dev }),
      sapper.middleware({
        // Don't forger that!
        session: (req, res) => ({
          user: req.user,
        }),
      })
    )
    .listen(PORT, (err) => {
      if (err) console.log("error", err);
    });
})();
```

Now, let's add some configuration to our `SapperOIDCClient`, it accept an object with the following options
| Option | Example | Info |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| issuerURL | "http://accounts.google.com" | https://openid.net/specs/openid-connect-discovery-1_0.html |
| clientID | "8db8f07d-547d-4e8b-8d8b-218fc08b7188" | The ID of your OIDC client. |
| clientSecret | "3nxeS5K3mFe.5Hv7Gvjp6xUWq~" | The secret of your OIDC client. |
| redirectURI | "https://mysapperapp/cb" | It should be the complete URL of where your callback url will be (you will see bellow) |
| sessionMaxAge | 60 _ 60 _ 24 _ 7 | How much time a session can last in seconds. |
| authRequestMaxAge | 60 _ 60 | How much time before an auth request is deemed invalid in seconds. |
| protectedPaths | `js [{path: "/settings", recursive: true, forceAuth: true}, {path: "/profile", recursive: true, forceAuth: false}]` | Path that will trigger auth. See the table bellow for detailed informations. |
| authSuccessfulRedirectPath | "/settings" | |
| authFailedRedirectPath | "/error" | |
| callbackPath | "/cb" | This is where your user will be redirected to from the idp. |
| scope | "openid profile offline_access" | `openid offline_access` must be specified |
| refreshPath | "/refresh" | Where the client will send a request, to refresh it's tokens and infos. |

#### protectedPaths option

| Option    | Example     | Info                                                                                                                           |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| path      | "/settings" |                                                                                                                                |
| recursive | true        | If set to true it will try to log the user if the route start with `/settings` (in this example), example `/settings/security` |
| forceAuth | true        | If set to true, if the user doesn't have a session it will be redirected to the idp login page.                                |

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
  import { silentRenew } from "sapper-oidc/lib/client";

  export let session;
  $: {
      if(session && )
  }
  onMount(() => {
    silentRenew("/refresh", session.raw, e => console.log(e));
  });
</script>
```

If you look at your console, you'll see how the data are received.
