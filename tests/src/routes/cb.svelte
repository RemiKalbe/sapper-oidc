<script>
  import { onMount } from "svelte";
  import { callback } from "sapper-oidc/lib/client";

  onMount(() => {
    try {
      callback(true); // If true, the user will be redirected back to where he was before.
    } catch (error) {
      throw new Error(error);
    }
  });
</script>
