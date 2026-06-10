<script module lang="ts">
  // Scroll snapshots survive remounts (e.g. a route change that recreates the
  // whole list subtree), keyed by the caller-supplied `name`. Mirrors Content's
  // `name`→scrollRestore pattern; but for a *virtualized* list a plain scrollTop
  // restores inaccurately (only visible rows are in the DOM), so we persist
  // virtua's CacheSnapshot (measured row sizes) alongside the offset and restore
  // both — sizes via VList's `cache` prop, offset via `scrollTo` after mount.
  const scrollSnapshots = new Map<string, { offset: number; cache: any }>();

  /** Forget a saved position (e.g. after a refresh that should reset scroll). */
  export function clearVirtualScroll(name: string): void {
    scrollSnapshots.delete(name);
  }
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { VList } from 'virtua/svelte';
  import { cn } from '../ui/utils/cn';

  // Hide the native scrollbar until the user first scrolls. Browsers flash their
  // default scrollbar when a scroller's content size changes (e.g. a virtua list
  // mounting client-side, 0 → full height), and it lingers until the first
  // interaction — visually noisy. We hide it up front and reveal it on the first
  // real scroll, after which native scrollbar behaviour resumes. `no-scrollbar`
  // is the kit utility from `apartx-ui/styles/utilities.css`.
  const HIDE_SCROLLBAR = 'no-scrollbar';

  /**
   * Virtualized list (forward mode) on top of `virtua`'s `VList`.
   *
   * virtua measures dynamic row heights out of the box and preserves scroll
   * position on prepend via `shift` — the reason it's the single virtualization
   * primitive across the ApartX stack (see admin's MessagesList). For
   * chat/reverse/stick-to-bottom behaviour use the `MessagesList` preset built on
   * top of this base.
   *
   * Scroll restoration: pass a stable `name` and the list remembers/restores its
   * position across remounts (e.g. navigating away and back), keyed by `name` —
   * the same opt-in shape as the kit's `<Content name=…>`. Omit `name` to disable.
   *
   * Imperative handle (via `bind:this`):
   *   scrollToIndex(index, opts?) · scrollTo(offset) · getScrollSize() · getViewportSize()
   *
   * @example
   * let list;
   * <VirtualList bind:this={list} data={rows} getKey={(r) => r.id} onscroll={onScroll}>
   *   {#snippet children(item, index)}<Row {item} />{/snippet}
   * </VirtualList>
   */
  let {
    data,
    items,
    getKey,
    children,
    shift = false,
    overscan,
    onscroll,
    name,
    class: className,
    ...restProps
  }: {
    /** Row data. `items` is accepted as an alias. */
    data?: any[];
    items?: any[];
    getKey?: (item: any, index: number) => string | number;
    children: any;
    /** Set true while prepending older items to keep scroll position. */
    shift?: boolean;
    overscan?: number;
    onscroll?: (offset: number) => void;
    /** When set, remember/restore scroll position per this key across remounts. */
    name?: string;
    class?: string;
    [key: string]: any;
  } = $props();

  const rows = $derived(data ?? items ?? []);

  // virtua's VList measures the DOM and is not server-renderable; only mount it
  // in the browser. SSR/prerender emit a sized placeholder for layout stability.
  let mounted = $state(false);
  onMount(() => { mounted = true; });

  let vlist = $state<any>(null);

  // Revealed after the first user scroll (programmatic restore scrolls don't count).
  let scrolled = $state(false);

  // Sizes cache to initialize VList with, read fresh whenever `name` changes (the
  // {#key name} below recreates VList so a per-key cache takes effect).
  function initialCache() {
    return name ? scrollSnapshots.get(name)?.cache : undefined;
  }

  // Restore the saved offset after (re)mount / name change. Re-run is gated by
  // `restoredKey` so a single navigation restores exactly once. virtua observes
  // its scroller a frame after mount and may clamp `scrollTo` until row sizes
  // settle, so retry across a few frames until it sticks (cf. scrollRestore).
  // `restoring` suppresses saves meanwhile so transient offsets don't overwrite
  // the target we're restoring to.
  let restoredKey: string | null = null;
  let restoring = false;
  $effect(() => {
    const key = name ?? null;
    if (!mounted) return;
    if (restoredKey === key) return;
    restoredKey = key;
    if (!key) return;
    const target = scrollSnapshots.get(key)?.offset ?? 0;
    if (!target) return; // fresh screen → leave at top
    let tries = 0;
    restoring = true;
    const apply = () => {
      if (restoredKey !== key) { restoring = false; return; }
      vlist?.scrollTo(target);
      const cur = vlist?.getScrollOffset?.() ?? 0;
      if (Math.abs(cur - target) > 1 && tries++ < 12) {
        requestAnimationFrame(apply);
        return;
      }
      setTimeout(() => { restoring = false; }, 0);
    };
    tick().then(() => requestAnimationFrame(apply));
  });

  function onScrollInternal(offset: number) {
    // A genuine user scroll reveals the scrollbar; the programmatic restore
    // scroll (guarded by `restoring`) must not.
    if (!restoring) scrolled = true;
    if (name && !restoring) scrollSnapshots.set(name, { offset, cache: vlist?.getCache?.() });
    onscroll?.(offset);
  }

  export function scrollToIndex(index: number, opts?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }) {
    vlist?.scrollToIndex(index, opts);
  }
  export function scrollTo(offset: number) {
    vlist?.scrollTo(offset);
  }
  export function scrollBy(offset: number) {
    vlist?.scrollBy(offset);
  }
  export function getScrollSize(): number {
    return vlist?.getScrollSize?.() ?? 0;
  }
  export function getViewportSize(): number {
    return vlist?.getViewportSize?.() ?? 0;
  }
  export function getScrollOffset(): number {
    return vlist?.getScrollOffset?.() ?? 0;
  }
</script>

{#if mounted}
  {#key name}
    <VList
      bind:this={vlist}
      data={rows}
      {getKey}
      {shift}
      {overscan}
      cache={initialCache()}
      onscroll={onScrollInternal}
      class={cn(!scrolled && HIDE_SCROLLBAR, className)}
      {...restProps}
    >
      {#snippet children(item, index)}
        {@render children(item, index)}
      {/snippet}
    </VList>
  {/key}
{:else}
  <div class={className} aria-hidden="true"></div>
{/if}
