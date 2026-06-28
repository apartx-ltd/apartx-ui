<script lang="ts">
  // Single host for every open modal. Mount once near the app root. Watches the
  // engine's reactive `stack`, lazy-loads each instance's component (one chunk
  // per modal, fetched on first open), and renders it with its props + a `close`
  // callback bound to that instance. Each instance is wrapped in a <ModalLayer>
  // so its overlay gets a depth-aware z band (deeper = on top).
  import { stack, zForDepth } from './registry.svelte';
  import ModalHost from './ModalHost.svelte';
</script>

{#each stack as m, depth (m.key)}
  <ModalHost instance={m} z={zForDepth(depth)} />
{/each}
