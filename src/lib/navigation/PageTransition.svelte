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
  let {
    key,
    children,
    direction = 'forward',
    mode = 'auto',
    duration = 280,
    restoreScroll = false,
    class: className,
    contentClass,
  }: {
    key: unknown;
    children: () => any;
    /** Navigation direction: 'forward'/'back' slide, 'none' crossfades. */
    direction?: 'forward' | 'back' | 'none';
    /** 'auto' = slide on mobile / fade on desktop; 'fade' forces a crossfade. */
    mode?: 'auto' | 'slide' | 'fade';
    duration?: number;
    /** Remember/restore the panel's scroll position per `key` (e.g. on back). */
    restoreScroll?: boolean;
    class?: string;
    contentClass?: string;
  } = $props();

  const faded = $derived(mode === 'fade' || direction === 'none');

  // Don't animate the very first (possibly SSR'd) render — only later swaps.
  let started = $state(false);
  $effect(() => {
    started = true;
  });

  // Enter animation class for the incoming page; exit class for the leaving page.
  // CSS media queries turn these into slide-vs-fade per viewport — no JS needed.
  let enterKind = $derived<'fwd' | 'back' | 'fade' | 'none'>(
    !started ? 'none' : faded ? 'fade' : direction === 'back' ? 'back' : 'fwd',
  );

  // Resolved lazily at outro time so it reflects the navigation that is leaving.
  function exitKind(): 'fwd' | 'back' | 'fade' {
    return faded ? 'fade' : direction === 'back' ? 'back' : 'fwd';
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
    >
      {@render children()}
    </PageLayer>
  {/key}
</div>
