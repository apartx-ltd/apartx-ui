<script lang="ts">
  // Test-only probe inside <VirtualRouter>: renders the subtree router's currentHasParent
  // (reactively, so tests see it follow navigation) and reports the back-visibility getter.
  import { useRouter } from './useRouter.svelte';
  import { getBackVisibility, type BackVisibilityGetter } from '../../navigation/context';
  let { onbackvisibility }: {
    onbackvisibility?: (g: BackVisibilityGetter | undefined) => void;
  } = $props();
  const router = useRouter();
  // svelte-ignore state_referenced_locally -- read once at mount
  onbackvisibility?.(getBackVisibility());
</script>

<span data-testid="has-parent" data-value={String(router.currentHasParent)}></span>
