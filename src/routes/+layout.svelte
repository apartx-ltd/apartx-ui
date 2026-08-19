<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { applyTheme } from '$lib/theme/apply-theme';
  import { useSvelteKitNavigation } from '$lib/router/sveltekit';
  import PageTransition from '$lib/navigation/PageTransition.svelte';
  import { Icon } from '$lib/ui/display';
  import { faBars } from '@fortawesome/free-solid-svg-icons';
  import { faGithub } from '@fortawesome/free-brands-svg-icons';
  import { Drawer } from '$lib/ui/overlays';
  // Named imports (not a default import of the whole file) so Vite tree-shakes
  // the rest of package.json out of the client bundle. The route is prerendered,
  // so both values are baked in at build time.
  import { version, repository } from '../../package.json';

  // package.json carries the npm-style `git+…​.git` form; strip it for an href.
  const repoUrl = repository.url.replace(/^git\+/, '').replace(/\.git$/, '');

  let { children } = $props();

  // Wire SvelteKit → kit: registers the SvelteKit history adapter as the active
  // backend (so kit overlays close), adapts the Navigator, and exposes the
  // page-transition direction. This is the canonical host wiring; Meteor consumers
  // adapt their own router the same way. `skNav.direction` is read lazily (function
  // form) at transition time — the adapter's action isn't a reactive signal.
  const skNav = useSvelteKitNavigation();

  onMount(() => {
    applyTheme('#1976d2');
  });

  const nav = [
    { path: '/', label: 'Overview' },
    { path: '/components', label: 'Components' },
    { path: '/display', label: 'Display' },
    { path: '/typography', label: 'Typography' },
    { path: '/structure', label: 'Structure' },
    { path: '/data', label: 'Data' },
    { path: '/forms', label: 'Forms' },
    { path: '/overlays', label: 'Overlays' },
    { path: '/maps', label: 'Maps' },
    { path: '/lightbox', label: 'Lightbox' },
    { path: '/hooks', label: 'Hooks' },
    { path: '/chat', label: 'Chat' },
    { path: '/editor', label: 'Editor' },
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

<!-- Rendered twice — desktop <aside> and the mobile <Drawer> — so the version
     footer lands on both surfaces from one place. min-h-full (not h-full) lets
     the column grow past the viewport when the nav is long: the footer then
     scrolls with the list instead of squashing it. -->
{#snippet sidebar()}
  <div class="flex min-h-full flex-col">
    <a href="{base}/" class="mb-6 block">
      <span class="text-title-lg text-primary font-semibold">ApartX UI</span>
      <span class="block text-body-sm text-on-surface-variant">Svelte 5 · Tailwind v4</span>
    </a>
    <nav class="flex flex-1 flex-col gap-1">
      {#each nav as item (item.path)}
        <a
          href={item.path === '/' ? base || '/' : `${base}${item.path}`}
          class="rounded-sm px-3 py-2 text-label-lg transition-colors hover:bg-primary/8"
          class:bg-primary={current === item.path}
          class:text-on-primary={current === item.path}
        >
          {item.label}
        </a>
      {/each}
    </nav>
    <footer
      class="mt-6 flex items-center justify-between gap-2 border-t border-outline-variant pt-3"
    >
      <span class="text-caption">v{version}</span>
      <a
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        class="text-label inline-flex items-center gap-1.5 transition-colors hover:text-on-surface"
      >
        <Icon icon={faGithub} />
        GitHub
      </a>
    </footer>
  </div>
{/snippet}

<!-- h-dvh (not h-screen/100vh): on mobile the browser chrome shrinks the visible
     area, but 100vh counts the largest viewport, pushing the bottom under the
     toolbar where body's overflow:hidden makes it unreachable. dvh tracks the
     real visible height. -->
<div class="flex h-dvh overflow-hidden bg-surface text-on-surface">
  <!-- Desktop sidebar -->
  <aside
    class="hidden w-56 shrink-0 overflow-y-auto scrollbar-none border-r border-outline-variant p-4 sm:block"
  >
    {@render sidebar()}
  </aside>

  <!-- Mobile drawer — the kit's Drawer component (hidden on desktop). -->
  <div class="sm:hidden">
    <Drawer bind:open={menuOpen} side="left" class="w-64">
      <div class="h-full overflow-y-auto scrollbar-none p-4">
        {@render sidebar()}
      </div>
    </Drawer>
  </div>

  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Mobile top bar -->
    <header class="flex items-center gap-3 border-b border-outline-variant p-3 sm:hidden">
      <button
        type="button"
        onclick={() => (menuOpen = true)}
        aria-label="Open menu"
        class="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
      >
        <Icon icon={faBars} />
      </button>
      <span class="text-title-md text-primary font-semibold">ApartX UI</span>
    </header>

    <main class="flex-1 overflow-hidden">
      <PageTransition
        key={page.url.pathname}
        direction={() => skNav.direction}
        restoreScroll
        contentClass="p-5 sm:p-8"
      >
        {@render children()}
      </PageTransition>
    </main>
  </div>
</div>
