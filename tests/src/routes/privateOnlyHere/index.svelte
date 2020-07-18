<script>
  import { accessToken, IDToken } from "../../userStore";
</script>

{#if $accessToken && $IDToken}
  <h1>Yes PPNR</h1>
{/if}
