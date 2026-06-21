<!-- projects/apartx-ui/src/routes/router-demo/detail/+page.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/ui/display';

  const id = $derived(page.url.searchParams.get('id') ?? '—');
</script>

<h1 class="text-headline-md mb-2">Detail: {id}</h1>
<p class="text-body-md text-on-surface-variant mb-6">
  Navigating here should slide forward; the browser back button should slide back to the list.
</p>

<Button onclick={() => history.back()}>← Back</Button>
