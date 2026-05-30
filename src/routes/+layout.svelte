<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { applyTheme } from '$lib/theme/apply-theme';
  import { setNavigator, matchActive, type Navigator } from '$lib/navigation';
  import PageTransition from '$lib/navigation/PageTransition.svelte';

  let { children } = $props();

  // Adapt SvelteKit's router to the kit's Navigator contract — example of how a
  // host wires the UI Kit. Meteor consumers would adapt their own router here.
  const navigator: Navigator = {
    push: (href) => goto(href),
    replace: (href) => goto(href, { replaceState: true }),
    back: () => history.back(),
    get current() {
      return { pathname: page.url.pathname, search: page.url.search, hash: page.url.hash };
    },
    isActive: (href, opts) => matchActive(page.url.pathname, href, opts),
  };
  setNavigator(navigator);

  onMount(() => {
    applyTheme('#1976d2');
  });

  const nav = [
    { path: '/', label: 'Overview' },
    { path: '/components', label: 'Components' },
    { path: '/display', label: 'Display' },
    { path: '/structure', label: 'Structure' },
    { path: '/data', label: 'Data' },
    { path: '/forms', label: 'Forms' },
    { path: '/overlays', label: 'Overlays' },
    { path: '/hooks', label: 'Hooks' },
  ];

  // Strip the base prefix so active-state matching works under any base path.
  let current = $derived(page.url.pathname.slice(base.length) || '/');
</script>

<div class="flex h-screen overflow-hidden bg-surface text-on-surface">
  <aside class="w-56 shrink-0 overflow-y-auto border-r border-outline-variant p-4">
    <a href="{base}/" class="block mb-6">
      <span class="text-title-lg text-primary font-semibold">ApartX UI</span>
      <span class="block text-body-sm text-on-surface-variant">Svelte 5 · Tailwind v4</span>
    </a>
    <nav class="flex flex-col gap-1">
      {#each nav as item (item.path)}
        <a
          href="{base}{item.path === '/' ? '' : item.path}"
          class="rounded-sm px-3 py-2 text-label-lg transition-colors hover:bg-primary/8"
          class:bg-primary={current === item.path}
          class:text-on-primary={current === item.path}
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <main class="flex-1 overflow-auto p-8">
    <PageTransition key={page.url.pathname}>
      {@render children()}
    </PageTransition>
  </main>
</div>
