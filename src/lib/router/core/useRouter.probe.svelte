<script lang="ts">
  // Test-only probe: useRouter() needs a component context (getContext + $effect),
  // so useRouter.test.ts mounts this and receives the live router via callback.
  import { useRouter } from './useRouter.svelte';
  import { getNavigator, getRouteKey, type Navigator, type RouteKeyGetter } from '../../navigation/context';
  let { onrouter, onnavigator, onroutekey }: {
    onrouter: (r: ReturnType<typeof useRouter>) => void;
    onnavigator?: (n: Navigator | undefined) => void;
    onroutekey?: (g: RouteKeyGetter | undefined) => void;
  } = $props();
  onrouter(useRouter());
  onnavigator?.(getNavigator());
  onroutekey?.(getRouteKey());
</script>
