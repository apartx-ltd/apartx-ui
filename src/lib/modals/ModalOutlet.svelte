<script lang="ts">
  // Single host for every open modal. Mount once near the app root. Watches the
  // engine's reactive `stack`, lazy-loads each instance's component (one chunk
  // per modal, fetched on first open), and renders it with its props + a `close`
  // callback bound to that instance. Each instance is wrapped in a <ModalLayer>
  // so its overlay gets a depth-aware z band (deeper = on top).
  import { stack, getModalRegistry, closeInstance, zForDepth } from './registry.svelte';
  import ModalLayer from './ModalLayer.svelte';

  const registry = getModalRegistry();
</script>

{#each stack as m, depth (m.key)}
  <ModalLayer z={zForDepth(depth)}>
    {#await registry?.[m.id]?.load() then mod}
      {#if mod}
        {@const ModalComponent = mod.default}
        <ModalComponent {...m.props} close={(result: any) => closeInstance(m.key, result)} />
      {/if}
    {/await}
  </ModalLayer>
{/each}
