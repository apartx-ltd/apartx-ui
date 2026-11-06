<script lang="ts">
  // Test-only page for Router.test.ts: hands the test a LAZY reader of its `params` prop —
  // the same kind of read a TanStack `queryFn: () => find(params.id)` closure does later.
  let { params, onmount }: { params: Record<string, string>; onmount: (read: () => Record<string, string>) => void } =
    $props();
  // svelte-ignore state_referenced_locally
  onmount(() => ({ ...params }));
</script>

<span data-page>{params.id}</span>
