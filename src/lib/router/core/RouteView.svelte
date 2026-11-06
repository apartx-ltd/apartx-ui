<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { RouteRecord } from './context';

  /**
   * One rendered view of a `<Router outlet>`. Internal to Router.svelte.
   *
   * The outlet re-keys its content by `key` (`PageTransition` → `{#key key}`), so every key
   * mounts its own view, and a view that LOST its key stays mounted while its exit animation
   * plays — or lives on in a closure the page left behind (a TanStack `queryFn`). Reading the
   * Router's live `active`/`params`, such a view would see the NEW route: the leaving page
   * re-fetched with a foreign id (sandyq!53). So a view serves the route of ITS key:
   *  - live `key` === the view's key → the live route (one key still covers param changes
   *    under `keyByMatch` and record changes under a shared `stableKey`); the snapshot follows;
   *  - otherwise → the snapshot from the moment of leaving. This holds from the very
   *    navigation, before Svelte flushes: `router.replace()` + `invalidateQueries()` in one
   *    task runs the leaving page's `queryFn` before any new view exists.
   * After the flush a view that is STILL live under a new key belongs to an outlet that does not
   * re-key (renders once, ignores `key`): it adopts the key and follows the live route again.
   * A leaving view never adopts — its branch is paused for the outro (paused effects don't run)
   * or already destroyed. A key that re-enters before the outro ends resumes the same view
   * (Svelte resurrects the branch): live again by the first rule.
   */
  let {
    key,
    active,
    params,
    children,
  }: {
    key: string;
    active: RouteRecord | null;
    params: Record<string, string>;
    children: Snippet<[RouteRecord | null, Record<string, string>]>;
  } = $props();

  let ownKey = $state(untrack(() => key));
  let snapActive = untrack(() => active);
  let snapParams = untrack(() => params);
  // Record and params are SEPARATE deriveds, and a frozen view must not depend on the live route
  // at all (hence the key check first). Separate matters: a param change must leave the record
  // the same reference, so nothing downstream that depends only on the record re-evaluates — in
  // Router's lazy branch a re-evaluated `getCached()` flips `{#await}` → `<Cached>` once the
  // chunk is cached and REMOUNTS the page (cabinet lost the slide of its gate PageTransition).
  const viewActive = $derived(key === ownKey ? (snapActive = active) : snapActive);
  const viewParams = $derived(key === ownKey ? (snapParams = params) : snapParams);

  $effect.pre(() => {
    // Runs only while this view's branch is live: adopt a key the outlet did not re-key on.
    if (key !== ownKey) ownKey = key;
    // Keep the snapshots current while live even if the page reads params only lazily (in a
    // closure): leaving must freeze the LAST live values, not the ones of the last read.
    viewActive;
    viewParams;
  });
</script>

{@render children(viewActive, viewParams)}
