<script lang="ts">
  import { untrack } from 'svelte';
  import { scrollRestore } from '../ui/utils/scroll-restore';
  import { setPagePortalHost } from './context';

  /**
   * One page in the transitioning stack. Used internally by `PageTransition`.
   *
   * Both ENTER and EXIT are CSS `@keyframes` animations — declarative, run on the
   * compositor, identical mechanism in both directions. That symmetry is the whole
   * point: a WAAPI/JS transition (Svelte's `css`/`tick`) flickers on iOS when a
   * fading top page is composited over a moving one (it samples easing into many
   * keyframes and holds discrete props like z-index unreliably). Pure CSS classes
   * don't. The classes + keyframes live in styles/page-transitions.css (global, so
   * the JS-added `pt-out-*` classes match) — not a scoped style block here.
   *
   *  - ENTER is a static class literal per branch (`pt-in-*`), so it is on the
   *    cloned template node at the very first paint; `animation-fill-mode:backwards`
   *    puts the page at its start before WebKit paints it. This avoids the iOS
   *    first-frame flash on a forward push.
   *  - EXIT can't be static (the leaving page already exists), so its class
   *    (`pt-out-*`, chosen by direction at outro) is added on `outrostart`. There
   *    is no first-frame to get wrong — the page starts settled. The class also
   *    carries the static stacking (z-index / shadow), never animated.
   *
   * The Svelte `out:hold` transition does no visual work; it only keeps the leaving
   * node mounted for `holdMs` so its CSS exit animation can finish before removal.
   * It is `tick`-based (not `css`) on purpose: a `css` transition would set the
   * inline `animation` property and clobber the `pt-out-*` class animation.
   * `|global` is required because the node lives inside an `{#if}`, so its
   * transition must still play when the parent `{#key}` block tears it down.
   */
  let {
    children,
    kind = 'none',
    exitKind,
    scrollKey = undefined,
    contentClass = '',
    holdMs = 320,
    providePortalHost = true,
  }: {
    children: () => any;
    /** Enter animation: 'fwd' | 'back' | 'fade' | 'none' (no animation). */
    kind?: 'fwd' | 'back' | 'fade' | 'none';
    /** Exit animation kind, resolved lazily at outro time. */
    exitKind?: () => 'fwd' | 'back' | 'fade';
    scrollKey?: string;
    contentClass?: string;
    holdMs?: number;
    /**
     * Whether this layer registers itself as the page-portal host for its subtree.
     * Default true. Set false on a NESTED <PageTransition> (e.g. a tab-content
     * router inside a shell) so that <BottomSheet portalTarget="page"> portals into
     * the OUTER, full-viewport layer that actually slides on a page push — not into
     * this inner, footer-bounded layer that stays put. Deferring keeps the parent
     * layer's host visible to descendants.
     */
    providePortalHost?: boolean;
  } = $props();

  // Snapshot so an in-flight page keeps its enter kind across later navigations.
  // `untrack` makes the one-time read explicit (no reactive subscription to `kind`).
  const k = untrack(() => kind);

  // Expose this layer's element so descendant overlays (e.g. <BottomSheet
  // portalTarget="page">) can portal INTO it and thus slide out WITH the page —
  // a <body>-portaled overlay would otherwise hang in place during the transition.
  // The getter stays reactive (the element appears on mount, persists through the
  // out:hold). Each layer sets its own host for its own subtree; the leaving page's
  // overlay therefore rides the leaving layer.
  let layerEl = $state<HTMLDivElement | null>(null);
  if (providePortalHost) setPagePortalHost(() => layerEl);

  // tick-only (no css) → sets no inline style, so it can't clobber the pt-out-*
  // class animation; it just keeps the node mounted for the animation's duration.
  function hold() {
    return { duration: holdMs, tick: () => {} };
  }

  function onOutro(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('pt-in-fwd', 'pt-in-back', 'pt-in-fade');
    const kind = exitKind?.();
    if (kind) el.classList.add(`pt-out-${kind}`);
  }
</script>

<!-- scrollRestore is on .pt-content (the scroller), NOT the layer (a non-scrolling
     transform stage) — restoring the layer's scroll would be a no-op. -->
{#snippet inner()}
  <div class="pt-content {contentClass}" use:scrollRestore={scrollKey}>{@render children()}</div>
{/snippet}

<!-- The enter class is a static literal per branch → present at the first paint. -->
{#if k === 'fwd'}
  <div bind:this={layerEl} class="pt-layer pt-in-fwd" out:hold|global onoutrostart={onOutro}>{@render inner()}</div>
{:else if k === 'back'}
  <div bind:this={layerEl} class="pt-layer pt-in-back" out:hold|global onoutrostart={onOutro}>{@render inner()}</div>
{:else if k === 'fade'}
  <div bind:this={layerEl} class="pt-layer pt-in-fade" out:hold|global onoutrostart={onOutro}>{@render inner()}</div>
{:else}
  <div bind:this={layerEl} class="pt-layer" out:hold|global onoutrostart={onOutro}>{@render inner()}</div>
{/if}
