<!-- projects/apartx-ui/src/routes/router-demo/+layout.svelte -->
<script lang="ts">
  import { setContext } from 'svelte';
  import { page } from '$app/state';
  import { PageTransition } from '$lib/navigation';
  import { useSvelteKitNavigation } from '$lib/router/sveltekit';

  let { children } = $props();

  // Wire the SvelteKit adapter once at the layout root: injects the kit Navigator
  // + route key, sets up the overlay-stack over SvelteKit's shallow routing, and
  // exposes the navigation direction for <PageTransition>.
  const nav = useSvelteKitNavigation();

  // Share the navigation handle (overlay stack) with descendant pages.
  setContext('router-demo:nav', nav);
</script>

<PageTransition key={page.url.pathname} direction={() => nav.direction}>
  {@render children()}
</PageTransition>
