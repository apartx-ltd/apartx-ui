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
  }: {
    children: () => any;
    /** Enter animation: 'fwd' | 'back' | 'fade' | 'none' (no animation). */
    kind?: 'fwd' | 'back' | 'fade' | 'none';
    /** Exit animation kind, resolved lazily at outro time. */
    exitKind?: () => 'fwd' | 'back' | 'fade';
    scrollKey?: string;
    contentClass?: string;
    holdMs?: number;
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
  setPagePortalHost(() => layerEl);

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

  /* ===== Mobile: Telegram/Android shared-axis directional slide ===== */
  @media (max-width: 640px) {
    /* forward: new page (leading, on top) slides in from the right + fades. */
    :global(.pt-in-fwd) {
      animation-name: ptInFwd;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }
    /* forward exit: old page (underneath) reverse-parallaxes left, no fade. */
    :global(.pt-out-fwd) {
      animation-name: ptOutFwd;
      z-index: 1;
    }
    /* back: the revealed page underneath parallaxes in from the left. */
    :global(.pt-in-back) {
      animation-name: ptInBack;
      z-index: 1;
    }
    /* back exit: old leading page (on top) slides out right + fades. */
    :global(.pt-out-back) {
      animation-name: ptOutBack;
      z-index: 2;
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
    }
  }
  @keyframes -global-ptInFwd {
    from {
      transform: translateX(30%);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes -global-ptOutFwd {
    from {
      transform: none;
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
      transform: none;
    }
  }
  @keyframes -global-ptOutBack {
    from {
      transform: none;
      opacity: 1;
    }
    to {
      transform: translateX(30%);
      opacity: 0;
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
  }
</style>
