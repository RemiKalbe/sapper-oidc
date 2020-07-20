<script>
  import { onMount } from "svelte";
  import { silentCallback, silentRenew } from "sapper-oidc/lib/client";
  import { goto } from "@sapper/app";
  import { accessToken, IDToken, expireAt } from "../userStore";

  onMount(() => {
    try {
      silentCallback(goto, async (user) => {
        await silentRenew(
          refreshPath,
          (e) => {
            $accessToken = e.raw.access_token;
            $IDToken = e.raw.id_token;
            $expireAt = e.raw.expires_at;
          },
          user
        );
        $accessToken = user.raw.access_token;
        $IDToken = user.raw.id_token;
        $expireAt = user.raw.expires_at;
      });
    } catch (error) {
      throw new Error(error);
    }
  });
</script>
