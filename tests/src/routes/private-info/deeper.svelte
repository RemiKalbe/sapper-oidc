<script>
  import { accessToken, IDToken } from "../../userStore";
</script>

{#if $accessToken && $IDToken}
  <h1>Yes PPRD</h1>
{/if}
