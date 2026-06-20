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
   * don't.
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

<style>
  /* Global so the animations ship with the component and the JS-added pt-out-*
     classes match. Duration/easing come from a CSS var set by PageTransition. */
  :global(.pt-layer) {
    position: absolute;
    inset: 0;
    /* The layer is a pure transform STAGE, not a scroller — per the kit's "only
       <Content> scrolls" contract, scrolling lives on .pt-content below. Crucially
       `overflow: visible` keeps the layer from being a scroll container, so a
       position:fixed overlay portaled into it (<BottomSheet portalTarget="page">)
       can't be yanked by a focus-driven scrollIntoView. The slide is clipped by the
       PageTransition root (overflow: clip — also a non-scrollable clip, so the yank
       can't relocate there either). */
    overflow: visible;
    /* Match the kit <Page> base (bg-background), NOT surface: the layer is the
       stage *under* the page, so its fallback fill must equal the page's own
       background or a seam shows wherever the page doesn't fully cover it. In
       light themes background==surface (no-op); they diverge in dark/Telegram
       themes (surface is lighter), which is where the old `surface` value bled
       through as a mismatched tone. */
    background: var(--color-background, #fff);
  }
  :global(.pt-content) {
    /* The actual scroller (definite height so it can scroll; the layer it lives in
       is inset:0 → definite). Pages that bring their own <Content> fill this and
       scroll internally, leaving it dormant. */
    height: 100%;
    overflow-y: auto;
    /* hide scrollbar so a stacked page doesn't flash one mid-slide */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  :global(.pt-content)::-webkit-scrollbar {
    display: none;
  }

  /* ===== Desktop default: crossfade ===== */
  :global(.pt-in-fwd),
  :global(.pt-in-back),
  :global(.pt-in-fade) {
    animation: ptFadeIn var(--pt-d, 280ms) var(--pt-e, cubic-bezier(0.2, 0, 0, 1)) backwards;
  }
  :global(.pt-out-fwd),
  :global(.pt-out-back),
  :global(.pt-out-fade) {
    animation: ptFadeOut var(--pt-d, 280ms) var(--pt-e, cubic-bezier(0.2, 0, 0, 1)) forwards;
    pointer-events: none;
  }
  @keyframes -global-ptFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes -global-ptFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  /* ===== Mobile slide: style chosen by [data-slide-style] on the PageTransition
     root (set from the OS-resolved `slideStyle` prop). Two variants below.
     `:where()` wraps the attribute so these rules keep specificity 0,1,0 (just
     `.pt-in-*`), letting the later reduced-motion override still win on mobile. ===== */
  @media (max-width: 640px) {
    /* ---- iOS: full-width OPAQUE push (no opacity; covers the outgoing page
       completely so nothing behind it bleeds through). ---- */
    :global(:where([data-slide-style='ios']) .pt-in-fwd) {
      animation-name: ptInFwd;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }
    :global(:where([data-slide-style='ios']) .pt-out-fwd) {
      animation-name: ptOutFwd;
      z-index: 1;
    }
    :global(:where([data-slide-style='ios']) .pt-in-back) {
      animation-name: ptInBack;
      z-index: 1;
    }
    :global(:where([data-slide-style='ios']) .pt-out-back) {
      animation-name: ptOutBack;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }

    /* ---- Material shared-axis: short slide on the LAYER (which stays opaque) +
       opacity fade on .pt-content. Fade on the content (not the layer) keeps the
       layer's opaque background covering the outgoing page → no bleed-through.
       Resting transform is translateZ(0), never `none`, so the layer stays a
       containing block for a portaled position:fixed BottomSheet → no flash. ---- */
    :global(:where([data-slide-style='shared-axis']) .pt-in-fwd) {
      animation-name: ptSaInFwd;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }
    :global(:where([data-slide-style='shared-axis']) .pt-out-fwd) {
      animation-name: ptSaOutFwd;
      z-index: 1;
    }
    :global(:where([data-slide-style='shared-axis']) .pt-in-back) {
      animation-name: ptSaInBack;
      z-index: 1;
    }
    :global(:where([data-slide-style='shared-axis']) .pt-out-back) {
      animation-name: ptSaOutBack;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }
    /* Content fade on the INCOMING forward page only: it materializes over the
       layer's opaque bg, so fading the content (not the layer) keeps the bg
       covering whatever is behind → no bleed-through. The underneath pages
       (out-fwd / in-back) just parallax, no fade. The LEAVING back page is faded
       at the LAYER level instead (see ptSaOutBack) — fading only its content
       would leave the opaque bg panel on screen and make the page "vanish" into
       a blank fill; fading the whole layer dissolves it to reveal the
       destination, which is the intended back gesture and safe (what shows
       through is the page we're returning to, not an unrelated screen). */
    :global(:where([data-slide-style='shared-axis']) .pt-in-fwd > .pt-content) {
      animation: ptSaContentIn var(--pt-d, 280ms) var(--pt-e, cubic-bezier(0.2, 0, 0, 1))
        backwards;
    }
  }
  /* The settled transform is translateZ(0), NOT `none`: a layer with `transform:
     none` stops being a containing block for its position:fixed descendants. A
     <BottomSheet portalTarget="page"> portaled into a layer must keep a stable
     containing block across the WHOLE animation — if a keyframe drops to `none`
     (even just the `from` at t=0) the sheet re-roots between compositor layers for
     one frame and the page behind it (e.g. a bottom nav) flashes through. translateZ(0)
     is an identity transform (no visual offset) that keeps the layer a containing
     block at every frame, matching the idle translateZ(0) set in the host CSS. */
  @keyframes -global-ptInFwd {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateZ(0);
    }
  }
  @keyframes -global-ptOutFwd {
    from {
      transform: translateZ(0);
    }
    to {
      transform: translateX(-12%);
    }
  }
  @keyframes -global-ptInBack {
    from {
      transform: translateX(-12%);
    }
    to {
      transform: translateZ(0);
    }
  }
  @keyframes -global-ptOutBack {
    from {
      transform: translateZ(0);
    }
    to {
      transform: translateX(100%);
    }
  }

  /* shared-axis layer keyframes — opaque, settled at translateZ(0) (see the note
     above the iOS keyframes about why not `none`). */
  @keyframes -global-ptSaInFwd {
    from {
      transform: translateX(30%);
    }
    to {
      transform: translateZ(0);
    }
  }
  @keyframes -global-ptSaOutFwd {
    from {
      transform: translateZ(0);
    }
    to {
      transform: translateX(-12%);
    }
  }
  @keyframes -global-ptSaInBack {
    from {
      transform: translateX(-12%);
    }
    to {
      transform: translateZ(0);
    }
  }
  /* back-exit: the whole leaving layer fades (bg + content together) while it
     slides — dissolving to reveal the destination underneath. translateZ(0) (not
     `none`) keeps the containing block stable; opacity rides with it. */
  @keyframes -global-ptSaOutBack {
    from {
      transform: translateZ(0);
      opacity: 1;
    }
    to {
      transform: translateX(30%);
      opacity: 0;
    }
  }
  /* shared-axis forward-in content fade (runs on .pt-content, layer bg stays opaque). */
  @keyframes -global-ptSaContentIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* ===== Reduced motion: quick opacity only, both viewports. Last wins. ===== */
  @media (prefers-reduced-motion: reduce) {
    :global(.pt-in-fwd),
    :global(.pt-in-back),
    :global(.pt-in-fade) {
      animation: ptFadeIn 120ms linear backwards;
    }
    :global(.pt-out-fwd),
    :global(.pt-out-back),
    :global(.pt-out-fade) {
      animation: ptFadeOut 120ms linear forwards;
      pointer-events: none;
    }
    /* shared-axis runs an opacity tween on the forward-in .pt-content; cancel it
       too. Must match that rule's specificity (`:where(...) .pt-in-fwd >
       .pt-content` = 0,2,0) and rely on later source order to win — a bare
       `.pt-content` (0,0,1) would lose and the tween would still run. */
    :global(.pt-in-fwd > .pt-content) {
      animation: none;
    }
  }
</style>
