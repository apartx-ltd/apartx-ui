<script lang="ts">
  // Test-only probe: useRouter() needs a component context (getContext + $effect),
  // so useRouter.test.ts mounts this and receives the live router via callback.
  import { useRouter } from './useRouter.svelte';
  let { onrouter }: { onrouter: (r: ReturnType<typeof useRouter>) => void } = $props();
  onrouter(useRouter());
</script>
