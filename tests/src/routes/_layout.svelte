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
  import { accessToken, IDToken, expireAt } from "../userStore";
  const { page } = stores();

  export let user;

  $: {
    if (user) {
      $accessToken = user.raw.access_token;
      $IDToken = user.raw.id_token;
      $expireAt = user.raw.expires_at;
      console.log(user);
    }
  }
  onMount(async () => {
    /* You can see the callback function assign "e" to "user",
		  "e" is the data returned when a token is refreshed, it is
		  the same structure as "user" returned before */
    await silentRenew(refreshPath, (e) => (user = e), user);
    page.subscribe(({ path }) => {
      /* If a user navigate client side to a route that you
			  configured to be available only to logged in user,
			  pathGuard will ensure that. */
      try {
        pathGuard(authPath, path, protectedPaths, user);
      } catch (error) {
        throw new Error(error);
      }
    });
  });
</script>

<main>
  <slot />
</main>
