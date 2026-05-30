<script lang="ts">
  import type { TransitionConfig } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  /**
   * Animate page changes. Wrap route content and pass a `key` that changes per
   * route (e.g. the pathname); the block re-mounts and transitions on change.
   *
   * On mobile (`mode='auto'`) it plays a Telegram-style directional slide:
   * `direction='forward'` enters right→left (the old page parallaxes left),
   * `direction='back'` reverses left→right, `direction='none'` crossfades.
   * On desktop it always crossfades. The host maps its router to a direction
   * (push→forward, back→back, replace→none) and passes it in — the kit keeps
   * no history of its own. Respects `prefers-reduced-motion`. Never routes.
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
    distance = 30,
    class: className,
    contentClass,
  }: {
    key: unknown;
    children: () => any;
    /** Navigation direction: 'forward'/'back' slide, 'none' crossfades. */
    direction?: 'forward' | 'back' | 'none';
    /** 'auto' = slide on mobile / fade on desktop; or force 'slide' / 'fade'. */
    mode?: 'auto' | 'slide' | 'fade';
    duration?: number;
    /** How far (%) the leading page travels — short, Telegram/Android style (not full width). */
    distance?: number;
    class?: string;
    contentClass?: string;
  } = $props();

  // --- Responsive + reduced-motion detection (client only) ---
  let isMobile = $state(false);
  let reduced = $state(false);

  $effect(() => {
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      isMobile = mqMobile.matches;
      reduced = mqReduced.matches;
    };
    sync();
    mqMobile.addEventListener('change', sync);
    mqReduced.addEventListener('change', sync);
    return () => {
      mqMobile.removeEventListener('change', sync);
      mqReduced.removeEventListener('change', sync);
    };
  });

  let slide = $derived(
    !reduced && direction !== 'none' && (mode === 'slide' || (mode === 'auto' && isMobile)),
  );

  const TOP = 'z-index:2;box-shadow:-8px 0 24px rgb(0 0 0 / 0.18);';

  // `u` is displacement (1 = fully displaced / pre-enter, 0 = settled).
  // Telegram/Android "shared axis": the leading page makes a short slide + fade;
  // the page underneath does a subtle reverse parallax (no fade).
  const leading = (u: number) =>
    `transform:translateX(${distance * u}%);opacity:${1 - u};${TOP}`;
  const trailing = (u: number) =>
    `transform:translateX(${-distance * 0.4 * u}%);z-index:1;`;

  function enter(_node: Element): TransitionConfig {
    const dir = direction;
    if (!slide) {
      return {
        duration: reduced ? 110 : 180,
        easing: cubicOut,
        css: (t, u) => `opacity:${t};transform:translateY(${reduced ? 0 : 8 * u}px);`,
      };
    }
    // Incoming page: leading on forward, the revealed page underneath on back.
    return {
      duration,
      easing: cubicOut,
      css: (_t, u) => (dir === 'back' ? trailing(u) : leading(u)),
    };
  }

  function exit(_node: Element): TransitionConfig {
    const dir = direction;
    if (!slide) {
      return {
        duration: reduced ? 110 : 150,
        easing: cubicOut,
        css: (t) => `opacity:${t};`,
      };
    }
    // Outgoing page: the page underneath on forward, leading (dismissed) on back.
    return {
      duration,
      easing: cubicOut,
      css: (_t, u) => (dir === 'back' ? leading(u) : trailing(u)),
    };
  }
</script>

<div class="relative h-full w-full overflow-hidden {className ?? ''}">
  {#key key}
    <!-- Opaque bg so stacked pages don't show through each other while sliding.
         Scrollbar hidden (scrollbar-none) so no bar shows mid-slide or lingers. -->
    <div
      class="absolute inset-0 bg-surface overflow-y-auto scrollbar-none {contentClass ?? ''}"
      in:enter
      out:exit
    >
      {@render children()}
    </div>
  {/key}
</div>
