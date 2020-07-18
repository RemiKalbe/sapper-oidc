<script>
  import { accessToken, IDToken } from "../../userStore";
</script>

{#if !$accessToken && !$IDToken}
  <h1>No NPPNR</h1>
{:else}
  <h1>Yes NPPNR</h1>
{/if}
