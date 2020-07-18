<script>
  import { accessToken, IDToken } from "../../userStore";
</script>

{#if $accessToken && $IDToken}
  <h1>Yes PPR</h1>
{/if}
