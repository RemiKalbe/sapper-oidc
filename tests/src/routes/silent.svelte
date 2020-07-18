<script>
  import { onMount } from "svelte";
  import { silentLogin } from "sapper-oidc/lib/client";

  onMount(() => {
    try {
      silentLogin(); // If true, the user will be redirected back to where he was before.
    } catch (error) {
      console.log(error);
    }
  });
</script>
