<script module lang="ts">
  // Monotonic layer stamp — lets the settle fallback below tell elder (stale) layers from younger
  // ones without trusting document order (Svelte keeps outroing nodes AFTER new blocks).
  let ptSeq = 0;

  const seqOf = (el: Element) => Number((el as HTMLElement).dataset.ptSeq || 0);

  // Put a stale layer out of the way. Normally: hide + make inert (Svelte still owns the actual
  // removal, whenever its stalled loop resumes). BUT if the router re-rendered live content INSIDE
  // this still-mounted layer (a younger layer nested within — happens when the stalled removal
  // outlives the next navigation), hiding it would hide the live page: neutralize instead — drop
  // the exit animation so a late fill-forwards frame can't shove the live subtree off-screen.
  function settleStaleLayer(el: HTMLElement) {
    const nested = el.querySelector<HTMLElement>('.pt-layer');
    if (nested && seqOf(nested) > seqOf(el)) {
      el.classList.remove('pt-out-fwd', 'pt-out-back', 'pt-out-fade');
      el.style.visibility = '';
      el.style.pointerEvents = '';
      // Svelte made the leaving layer inert at outro start; as a host of live content
      // that would keep the live page untouchable.
      el.inert = false;
      return;
    }
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
  }
</script>

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
  //
  // The tick doubles as the RESURRECTION hook. Svelte's BranchManager keeps an outroing
  // branch in its onscreen map until the outro finishes; if its key re-enters before then
  // (same page reopened while a stalled outro still holds the old layer), NO new branch is
  // created — this very element is resumed as the live page. The only synchronous signal is
  // `transition.in()` → `outro.reset()` → `tick(1)`, called with the element's Svelte-managed
  // `inert` already restored to false (a real outro frame also ticks t=1 first, but there
  // Svelte's `out()` has set `inert = true`). On that signal, undo everything the exit path
  // and the settle insurance below did to a layer that was presumed to be leaving.
  function hold() {
    return {
      duration: holdMs,
      tick: (t: number) => {
        if (t !== 1) return;
        const el = layerEl;
        if (!el || el.inert) return;
        clearTimeout(outroSettleTimer);
        el.classList.remove('pt-out-fwd', 'pt-out-back', 'pt-out-fade');
        el.style.visibility = '';
        el.style.pointerEvents = '';
      },
    };
  }

  // Wall-clock insurance for stalled animation clocks. Both the CSS enter animation and the
  // rAF-driven `out:hold` advance only while frames are produced; in a throttled environment
  // (headless, background tab, saturated main thread) they can freeze — the entering layer sticks
  // mid-slide (e.g. ptSaInFwd frozen at translateX(30%)) and the leaving layer never unmounts, so
  // repeated navigations STACK frozen layers. setTimeout runs on the wall clock, so at
  // holdMs+grace we force-finish whatever the frame clock still owes. In a healthy run both
  // callbacks are visual no-ops: a completed enter animation (fill: backwards) leaves the same
  // computed state as having no animation class, and a completed exit has already unmounted.
  const SETTLE_GRACE_MS = 250;

  // Enter-side insurance, armed on MOUNT — the only hook guaranteed to run even when the frame
  // clock is already stalled (a frozen rAF loop may never even START a sibling's outro, so the
  // outro-side timer below can't be the sole safety net). After the animation must have finished:
  //  1. drop this layer's pt-in-* class — a frozen enter snaps to its settled state (the class
  //     carries only the animation + transient stacking, both meaningless once settled);
  //  2. hide any ELDER sibling layer still mounted in this PageTransition — it missed its removal
  //     and would otherwise stack under/over the live page (Svelte still owns the actual removal).
  //     Elder = lower data-pt-seq stamp; document order can't be trusted (outroing nodes sort
  //     after new blocks), and younger siblings (rapid A→B→C navigation) must never be touched.
  $effect(() => {
    const el = layerEl;
    if (!el) return;
    el.dataset.ptSeq = String(++ptSeq);
    const t = setTimeout(() => {
      el.classList.remove('pt-in-fwd', 'pt-in-back', 'pt-in-fade');
      // Stale elder SIBLINGS in this PageTransition missed their removal — put them away.
      // Only siblings Svelte holds inert are actually leaving; an elder sibling that is
      // NOT inert was resurrected (its key re-entered) and is a live page — never touch it.
      el.parentElement?.querySelectorAll<HTMLElement>(':scope > .pt-layer').forEach((sib) => {
        if (sib === el || seqOf(sib) >= seqOf(el) || !sib.inert) return;
        settleStaleLayer(sib);
      });
      // Heal stale ANCESTORS this live layer got re-rendered into: an elder layer already hidden
      // by ITS settle timer (or still carrying an exit animation) would hide/offset this page —
      // visibility inherits. Un-hide and drop the exit class; it's a passive container now.
      for (
        let anc = el.parentElement?.closest<HTMLElement>('.pt-layer');
        anc;
        anc = anc.parentElement?.closest<HTMLElement>('.pt-layer')
      ) {
        if (seqOf(anc) < seqOf(el)) {
          anc.classList.remove('pt-out-fwd', 'pt-out-back', 'pt-out-fade');
          anc.inert = false;
          if (anc.style.visibility === 'hidden') {
            anc.style.visibility = '';
            anc.style.pointerEvents = '';
          }
        }
      }
    }, holdMs + SETTLE_GRACE_MS);
    return () => clearTimeout(t);
  });

  // Handle of the exit-insurance timer, so a resurrection (see hold) can cancel a hide
  // that would otherwise land on a layer that has become the live page again.
  let outroSettleTimer: ReturnType<typeof setTimeout> | undefined;

  function onOutro(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('pt-in-fwd', 'pt-in-back', 'pt-in-fade');
    const kind = exitKind?.();
    if (kind) el.classList.add(`pt-out-${kind}`);
    // Exit insurance: Svelte owns the node's removal (rAF-driven, may stall) — never remove it
    // here; just put a still-mounted leaving layer out of the way (hidden+inert, or neutralized
    // if live content got re-rendered inside it). Svelte deletes it whenever its loop resumes.
    clearTimeout(outroSettleTimer);
    outroSettleTimer = setTimeout(() => {
      if (!el.isConnected) return;
      settleStaleLayer(el);
    }, holdMs + SETTLE_GRACE_MS);
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
