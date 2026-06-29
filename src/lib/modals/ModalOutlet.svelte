<script lang="ts">
  // Single host for every open modal. Mount once near the app root. Watches the
  // engine's reactive `stack`, lazy-loads each instance's component (one chunk
  // per modal, fetched on first open), and renders it with its props + a `close`
  // callback bound to that instance. Each instance is wrapped in a <ModalLayer>
  // so its overlay gets a depth-aware z band (deeper = on top).
  import { onMount } from 'svelte';
  import { stack, zForDepth } from './registry.svelte';
  import { initOverlayStack } from '../router/overlay/overlay-stack';
  import ModalHost from './ModalHost.svelte';

  // Install the single overlay back-interceptor once on the client (idempotent,
  // SSR-safe). This is what makes a browser/native BACK close the topmost open
  // modal (registered per-instance in registry `open()`) instead of navigating
  // the page. Mounting <ModalOutlet> at the app root is the host's opt-in.
  onMount(() => {
    initOverlayStack();
  });
</script>

{#each stack as m, depth (m.key)}
  <ModalHost instance={m} z={zForDepth(depth)} />
{/each}
