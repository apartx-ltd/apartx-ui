<script lang="ts">
  // Test-only probe: useSvelteKitNavigation() calls setNavigator()/setRouteKey()
  // (Svelte setContext), which needs a component-init context, so
  // sveltekit.test.ts mounts this and receives the live result via callback.
  import { useSvelteKitNavigation } from './sveltekit';
  let { onready }: { onready: (nav: ReturnType<typeof useSvelteKitNavigation>) => void } = $props();
  onready(useSvelteKitNavigation());
</script>
