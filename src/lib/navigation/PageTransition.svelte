<script lang="ts">
  import PageLayer from './PageLayer.svelte';

  /**
   * Animate page changes. Wrap route content and pass a `key` that changes per
   * route (e.g. the pathname); the block re-mounts and transitions on change.
   *
   * On mobile it plays a Telegram-style directional slide: `direction='forward'`
   * enters right→left (the old page parallaxes left), `direction='back'` reverses
   * left→right, `direction='none'`/`mode='fade'` crossfades. On desktop it always
   * crossfades. Slide-vs-fade and reduced-motion are decided entirely in CSS media
   * queries (see PageLayer). The host maps its router to a direction (push→forward,
   * back→back, replace→none); the kit keeps no history and never routes.
   *
   * Both enter and exit are CSS `@keyframes` animations (see PageLayer) — the same
   * mechanism in both directions, so they look identical. Enter uses a static class
   * (correct first frame, no iOS flash); exit adds its class on outro and a Svelte
   * `out:` transition only keeps the leaving node mounted for the animation.
   *
   * @example
   *   <PageTransition key={page.url.pathname} contentClass="p-8">
   *     {@render children()}
   *   </PageTransition>
   */
  type Direction = 'forward' | 'back' | 'none';

  let {
    key,
    children,
    direction = 'forward',
    mode = 'auto',
    duration = 280,
    restoreScroll = false,
    providePortalHost = true,
    class: className,
    contentClass,
  }: {
    key: unknown;
    children: () => any;
    /**
     * Navigation direction: 'forward'/'back' slide, 'none' crossfades. May be a
     * FUNCTION `() => Direction`, resolved lazily at enter/outro time. Pass a
     * function when the host that owns the direction can be torn down by an
     * ANCESTOR (e.g. a nested-router shell unmounting to a detail route): a plain
     * value prop is frozen at the host's last render, so the leaving layer would
     * read a STALE direction (the host never re-renders before teardown — see
     * SlotLayout in apartx-spaces). A function reads live state at outro instead.
     * A string keeps the prior behaviour exactly.
     */
    direction?: Direction | (() => Direction);
    /** 'auto' = slide on mobile / fade on desktop; 'fade' forces a crossfade. */
    mode?: 'auto' | 'slide' | 'fade';
    duration?: number;
    /** Remember/restore the panel's scroll position per `key` (e.g. on back). */
    restoreScroll?: boolean;
    /**
     * Forwarded to <PageLayer>. Set false on a NESTED <PageTransition> so a
     * `portalTarget="page"` overlay portals into the OUTER layer (the one that
     * slides on a page push) instead of this inner one. See PageLayer.
     */
    providePortalHost?: boolean;
    class?: string;
    contentClass?: string;
  } = $props();

  const resolveDir = (): Direction => (typeof direction === 'function' ? direction() : direction);
  const kindFor = (d: Direction): 'fwd' | 'back' | 'fade' =>
    mode === 'fade' || d === 'none' ? 'fade' : d === 'back' ? 'back' : 'fwd';

  // Don't animate the very first (possibly SSR'd) render — only later swaps.
  let started = $state(false);
  $effect(() => {
    started = true;
  });

  // Enter animation class for the incoming page; exit class for the leaving page.
  // CSS media queries turn these into slide-vs-fade per viewport — no JS needed.
  // `key` is a dep so a function `direction` is re-resolved per navigation: the
  // function reference is stable, so without it the derived would never go dirty
  // and would reuse the previous page's enter kind.
  let enterKind = $derived.by<'fwd' | 'back' | 'fade' | 'none'>(() => {
    key;
    return !started ? 'none' : kindFor(resolveDir());
  });

  // Resolved lazily at outro time so it reflects the navigation that is leaving.
  function exitKind(): 'fwd' | 'back' | 'fade' {
    return kindFor(resolveDir());
  }
</script>

<!-- overflow-clip (not -hidden): clips the slide WITHOUT being a scroll container, so
     a focus-driven scrollIntoView on a portaled fixed overlay (BottomSheet
     portalTarget="page") has no scrollable ancestor to yank — see PageLayer. -->
<div class="relative h-full w-full overflow-clip {className ?? ''}" style="--pt-d:{duration}ms">
  {#key key}
    <PageLayer
      kind={enterKind}
      {exitKind}
      scrollKey={restoreScroll ? String(key) : undefined}
      contentClass={contentClass ?? ''}
      holdMs={duration + 40}
      {providePortalHost}
    >
      {@render children()}
    </PageLayer>
  {/key}
</div>
