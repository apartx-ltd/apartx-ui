<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto, beforeNavigate } from '$app/navigation';
  import { applyTheme } from '$lib/theme/apply-theme';
  import { setNavigator, matchActive, type Navigator } from '$lib/navigation';
  import PageTransition from '$lib/navigation/PageTransition.svelte';
  import { Icon } from '$lib/ui/display';

  let { children } = $props();

  // Page-transition direction, derived straight from the router's navigation
  // events — no heuristic. push/link → forward, popstate-back → back, replace →
  // none (crossfade). `replace` can't be read off the navigation event, so the
  // adapter flags it; back/forward come from popstate `delta`.
  let transitionDir = $state<'forward' | 'back' | 'none'>('forward');
  let replaceNext = false;

  beforeNavigate((nav) => {
    if (replaceNext) {
      transitionDir = 'none';
      replaceNext = false;
    } else if (nav.type === 'popstate') {
      transitionDir = (nav.delta ?? 0) < 0 ? 'back' : 'forward';
    } else {
      transitionDir = 'forward';
    }
  });

  // Adapt SvelteKit's router to the kit's Navigator contract — example of how a
  // host wires the UI Kit. Meteor consumers would adapt their own router here.
  const navigator: Navigator = {
    push: (href) => goto(href),
    replace: (href) => {
      replaceNext = true;
      return goto(href, { replaceState: true });
    },
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

  let menuOpen = $state(false);

  // Close the mobile drawer after navigating away.
  $effect(() => {
    current; // track
    menuOpen = false;
  });
</script>

{#snippet sidebar()}
  <a href="{base}/" class="mb-6 block">
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
{/snippet}

<div class="flex h-screen overflow-hidden bg-surface text-on-surface">
  <!-- Desktop sidebar -->
  <aside
    class="hidden w-56 shrink-0 overflow-y-auto scrollbar-none border-r border-outline-variant p-4 sm:block"
  >
    {@render sidebar()}
  </aside>

  <!-- Mobile drawer + scrim -->
  {#if menuOpen}
    <div class="fixed inset-0 z-40 sm:hidden">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="absolute inset-0 bg-scrim/40" onclick={() => (menuOpen = false)}></div>
      <aside
        class="absolute left-0 top-0 h-full w-64 overflow-y-auto scrollbar-none border-r border-outline-variant bg-surface p-4 shadow-level-3"
      >
        {@render sidebar()}
      </aside>
    </div>
  {/if}

  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Mobile top bar -->
    <header class="flex items-center gap-3 border-b border-outline-variant p-3 sm:hidden">
      <button
        type="button"
        onclick={() => (menuOpen = true)}
        aria-label="Open menu"
        class="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
      >
        <Icon name="bars" />
      </button>
      <span class="text-title-md text-primary font-semibold">ApartX UI</span>
    </header>

    <main class="flex-1 overflow-hidden">
      <PageTransition key={page.url.pathname} direction={transitionDir} contentClass="p-5 sm:p-8">
        {@render children()}
      </PageTransition>
    </main>
  </div>
</div>
