<script>
  import { authPath } from "../OIDCConfig";
  import { auth } from "sapper-oidc/lib/client";
  import { goto } from "@sapper/app";
  import { accessToken, IDToken, expireAt } from "../userStore";
</script>

<button on:click={() => auth(authPath)} id="login">Login</button>
<button on:click={() => goto('/private-info')} id="PPR">
  Protected Path (Recursive)
</button>
<button on:click={() => goto('/private-info/deeper')} id="PPRD">
  Protected Path (Recursive) Deeper
</button>
<button on:click={() => goto('/privateOnlyHere')} id="PPNR">
  Protected Path (Not Recursive)
</button>
<button on:click={() => goto('/privateOnlyHere/deeper')} id="NPPNR">
  Not Protected Path (Not Recursive) Deeper
</button>

{#if $accessToken && $IDToken && $expireAt}
  <h1>Yes</h1>
  <h2>{$expireAt}</h2>
{/if}
