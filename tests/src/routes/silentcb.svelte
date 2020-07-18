<script>
  import { onMount } from "svelte";
  import { silentCallback } from "sapper-oidc/lib/client";
  import { goto } from "@sapper/app";
  import { accessToken, IDToken, expireAt } from "../userStore";

  onMount(() => {
    try {
      silentCallback(goto, (user) => {
        if (user) {
          $accessToken = user.raw.access_token;
          $IDToken = user.raw.id_token;
          $expireAt = user.raw.expires_at;
        }
      });
    } catch (error) {
      throw new Error(error);
    }
  });
</script>
