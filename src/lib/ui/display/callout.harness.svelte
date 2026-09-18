<script>
  // Callout со сниппетами (тело, действия, заголовок-сниппет) — mount() их из теста не передаст.
  import Callout from './Callout.svelte';
  import { faBell } from '@fortawesome/free-solid-svg-icons';

  let { tone, withIcon = false, withBody = true, withActions = false, snippetTitle = false, title = 'Sign the contract', ...rest } = $props();
</script>

{#snippet actions()}<button data-testid="slot-action">Sign</button>{/snippet}
{#snippet richTitle()}<span data-testid="slot-title">Contract <small>pending</small></span>{/snippet}

<Callout
  {tone}
  icon={withIcon ? faBell : undefined}
  title={snippetTitle ? richTitle : title}
  actions={withActions ? actions : undefined}
  {...rest}
>
  {#if withBody}You need to sign the contract.{/if}
</Callout>
