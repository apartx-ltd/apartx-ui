<script lang="ts">
  // Test-only probe: a <Link> either plain or inside a <VirtualRouter hashParam="panel">.
  import Link from './Link.svelte';
  import VirtualRouter from './VirtualRouter.svelte';

  let { to, replace = false, virtual = false, onclick }: {
    to: string;
    replace?: boolean;
    virtual?: boolean;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

{#if virtual}
  <VirtualRouter hashParam="panel" prefix="/accounts">
    <Link {to} {replace} {onclick} data-testid="link">go</Link>
  </VirtualRouter>
{:else}
  <Link {to} {replace} {onclick} data-testid="link">go</Link>
{/if}
