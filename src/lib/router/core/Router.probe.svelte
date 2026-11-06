<script lang="ts">
  // Test-only harness for Router.test.ts: a <Router> with the outlet shapes consumers use.
  //  - 'keyed'      — `{#key key}` around render (what PageTransition does, minus the outro);
  //  - 'transition' — the real kit PageTransition (leaving layer stays mounted for its outro);
  //  - 'unkeyed'    — an outlet that ignores `key` (one render for the router's lifetime);
  //  - 'none'       — no outlet at all.
  import Router from './Router.svelte';
  import Route from './Route.svelte';
  import PageTransition from '../../navigation/PageTransition.svelte';
  import Page from './Router.probe-page.svelte';

  let {
    outlet = 'keyed',
    keyByMatch = false,
    onmount,
  }: {
    outlet?: 'keyed' | 'transition' | 'unkeyed' | 'none';
    keyByMatch?: boolean;
    onmount: (route: string, read: () => Record<string, string>) => void;
  } = $props();
  // Lazy route: a fresh loader per probe instance, so the module-level chunk cache (./lazy) starts
  // cold in every test — the first visit renders through `{#await load()}`.
  const lazyPage = () => Promise.resolve({ default: Page });
</script>

{#snippet routes()}
  <Route path="/a/:id" exact component={Page} props={{ onmount: (r: () => Record<string, string>) => onmount('a', r) }} />
  <Route path="/l/:id" exact loader={lazyPage} props={{ onmount: (r: () => Record<string, string>) => onmount('l', r) }} />
  <Route path="/b/:id" exact component={Page} props={{ onmount: (r: () => Record<string, string>) => onmount('b', r) }} />
{/snippet}

{#if outlet === 'keyed'}
  <Router {keyByMatch} children={routes}>
    {#snippet outlet({ render, key })}
      {#key key}{@render render()}{/key}
    {/snippet}
  </Router>
{:else if outlet === 'transition'}
  <Router {keyByMatch} children={routes}>
    {#snippet outlet({ render, key })}
      <PageTransition {key} mode="fade">{@render render()}</PageTransition>
    {/snippet}
  </Router>
{:else if outlet === 'unkeyed'}
  <Router {keyByMatch} children={routes}>
    {#snippet outlet({ render })}
      {@render render()}
    {/snippet}
  </Router>
{:else}
  <Router {keyByMatch} children={routes} />
{/if}
