<script lang="ts">
  import { Popover as BitsPopover } from 'bits-ui';
  import { cn } from '../utils/cn';

  /**
   * Universal popover — a floating surface anchored to a trigger.
   * `PopoverJson` is a specialised instance of this pattern.
   *
   * Provide the anchor via the `trigger` snippet and the floating body via the
   * default `children` snippet. Optionally bind `open`.
   *
   * Anchor without a trigger: pass `customAnchor` (an element, selector, or a
   * floating-ui virtual `{ getBoundingClientRect() }`) — e.g. to anchor at a
   * cursor point on a canvas. `customAnchor` flows through to bits-ui Content.
   *
   * `portal`: by default the content renders inline. Set `portal` (true → body,
   * or a target element/selector) to portal the content out — required when an
   * ancestor establishes a stacking context / transform containing block (e.g. a
   * `<PageTransition>` layer) that would otherwise trap the fixed surface.
   *
   * `modal`: render a transparent full-screen scrim under the content that closes
   * the popover on click AND blocks the click from reaching whatever is behind
   * (bits-ui Popover is non-modal and has no backdrop, so without this an outside
   * click reaches the page — e.g. a canvas that would open a *second* popover
   * before this one dismisses). Pairs with `portal` so the scrim sits above page
   * content.
   *
   * `fitViewport` (with `customAnchor`): when the content is too tall for the
   * room on its anchored side it would otherwise scroll while the *other* side of
   * the anchor sits empty (bits-ui's shift is horizontal-only, so a cursor pin
   * can't span across itself). With `fitViewport` set, once the surface overflows
   * we re-anchor it to the bottom edge and open it upward (keeping the anchor's
   * X) — it hugs the bottom of the viewport, sliding up only as far as needed to
   * fit, so it stays near the cursor instead of jumping to the top. Its
   * available-side space is the whole viewport, so it grows to full height and
   * only scrolls when the content genuinely exceeds the screen. Short content
   * that fits stays pinned at the anchor.
   *
   * @example
   * <Popover side="bottom" align="start">
   *   {#snippet trigger()}
   *     <Button variant="outlined">Open</Button>
   *   {/snippet}
   *   <div class="p-3">Popover body</div>
   * </Popover>
   */
  let {
    children,
    trigger,
    open = $bindable(false),
    side = 'bottom',
    align = 'center',
    sideOffset = 4,
    trapFocus = true,
    portal = false,
    modal = false,
    fitViewport = false,
    customAnchor,
    triggerClass,
    contentClass,
    class: className,
    ...restProps
  }: {
    children: any;
    trigger?: any;
    open?: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
    trapFocus?: boolean;
    portal?: boolean | Element | string;
    modal?: boolean;
    fitViewport?: boolean;
    customAnchor?: Element | string | { getBoundingClientRect: () => DOMRect } | null;
    triggerClass?: string;
    contentClass?: string;
    class?: string;
    [key: string]: any;
  } = $props();

  // `disabled` Portal renders inline (no-op) — keeps the default behaviour
  // byte-faithful for existing consumers; a truthy `portal` lifts content to
  // <body> (or the given target).
  const portalDisabled = $derived(portal === false || portal == null);
  const portalTo = $derived(typeof portal === 'boolean' ? undefined : portal);

  // --- fitViewport: re-anchor a tall, overflowing surface to the bottom edge ---
  const VIEWPORT_MARGIN = 8;
  let contentEl = $state<HTMLElement | null>(null);
  let overflowing = $state(false);

  function anchorRect(a: typeof customAnchor): DOMRect | null {
    if (a == null) return null;
    if (typeof a === 'string') return document.querySelector(a)?.getBoundingClientRect() ?? null;
    if (typeof (a as any).getBoundingClientRect === 'function') return (a as any).getBoundingClientRect();
    return null;
  }

  $effect(() => {
    if (!open) {
      overflowing = false;
      return;
    }
    if (!fitViewport || !contentEl) return;
    const el = contentEl;
    // Measure after floating-ui has positioned + size-capped the content.
    const raf = requestAnimationFrame(() => {
      if (el.scrollHeight > el.clientHeight + 1) overflowing = true;
    });
    return () => cancelAnimationFrame(raf);
  });

  // While overflowing, anchor to the bottom edge at the original anchor's X and
  // open upward: the surface hugs the bottom of the viewport (sliding up only as
  // far as needed to fit) instead of pinning to the top, and its available-side
  // height becomes ~the whole viewport. Latched until close.
  const effectiveAnchor = $derived.by(() => {
    if (!fitViewport || !overflowing || customAnchor == null) return customAnchor;
    const left = anchorRect(customAnchor)?.left ?? 0;
    return {
      getBoundingClientRect: () =>
        new DOMRect(left, window.innerHeight - VIEWPORT_MARGIN, 0, 0),
    };
  });
  const effectiveSide = $derived(fitViewport && overflowing ? 'top' : side);
  const effectiveAlign = $derived(fitViewport && overflowing ? 'start' : align);
</script>

<BitsPopover.Root bind:open>
  {#if trigger}
    <BitsPopover.Trigger class={triggerClass}>
      {@render trigger()}
    </BitsPopover.Trigger>
  {/if}

  <BitsPopover.Portal disabled={portalDisabled} to={portalTo}>
    {#if modal && open}
      <!-- Blocking scrim (transparent): catches the outside click — closing the
           popover — and stops it propagating to page content behind (z-40, just
           under the content's z-50). Without it, bits-ui's non-modal dismiss lets
           the same click reach e.g. a canvas and open another popover. -->
      <div
        class="fixed inset-0 z-40"
        role="presentation"
        onclick={() => (open = false)}
        oncontextmenu={(e) => { e.preventDefault(); open = false; }}
      ></div>
    {/if}
    <BitsPopover.Content
      bind:ref={contentEl}
      side={effectiveSide}
      align={effectiveAlign}
      customAnchor={effectiveAnchor}
      {sideOffset}
      {trapFocus}
      class={cn(
        'z-50 rounded-sm bg-surface shadow-level-3 border border-outline-variant overflow-hidden',
        // Stay within the viewport: bits-ui's floating size middleware exposes the
        // space available on the chosen side (flip already picks the larger side)
        // as a CSS var — cap the height to it and scroll the overflow instead of
        // bleeding off screen. (bits-ui's shift is horizontal-only — crossAxis is
        // off — so a cursor-anchored surface can't span across its anchor; the
        // far side's space is unreachable by design. Capping to 100dvh instead
        // would let it overflow off-screen since nothing shifts it back up.)
        // No-op when the var is unset (e.g. avoidCollisions={false}).
        'max-h-[var(--bits-popover-content-available-height)] overflow-y-auto',
        className,
        contentClass,
      )}
      {...restProps}
    >
      {@render children()}
    </BitsPopover.Content>
  </BitsPopover.Portal>
</BitsPopover.Root>
