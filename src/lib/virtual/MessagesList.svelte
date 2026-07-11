<script lang="ts">
  import { tick } from 'svelte';
  import VirtualList from './VirtualList.svelte';

  /**
   * Messages/feed preset over `VirtualList`. The virtua Svelte adapter has no
   * `reverse` prop, so stick-to-bottom is driven manually via
   * `scrollToIndex(last, { align: 'end' })`, and `shift` keeps the scroll
   * position when older items are prepended. Logic mirrors the battle-tested
   * admin message list.
   *
   * Bind the component to call `scrollToBottom()` / `stick()` after sending.
   *
   * @example
   * let feed;
   * <MessagesList bind:this={feed} data={messages} getKey={(m) => m._id}
   *               hasMore={store.hasMore()} onLoadOlder={() => store.fetch()}>
   *   {#snippet children(m, i)}<Message {m} />{/snippet}
   * </MessagesList>
   */
  let {
    data,
    items,
    getKey,
    children,
    hasMore = false,
    onLoadOlder,
    /** Pixels from the top at which to trigger loading older items. */
    loadOlderThreshold = 100,
    /** Pixels from the bottom still considered "stuck" to the bottom. */
    stickThreshold = 1.5,
    onStickChange,
    /** Distance from the bottom (px) past which `onScrollAwayChange(true)` fires — drives a
     *  host scroll-to-bottom button. Larger than `stickThreshold` so the button only shows
     *  after a deliberate scroll up, not on a hair off the bottom. */
    scrollAwayThreshold = 100,
    onScrollAwayChange,
    /** Index to land on at first load: the unread divider, else < 1 for the bottom. Positioning is
     *  driven ONCE, here — the host must not also call scrollToBottom/scrollToIndex on open. */
    initialIndex = null,
    class: className,
    ...restProps
  }: {
    data?: any[];
    items?: any[];
    getKey?: (item: any, index: number) => string | number;
    children: any;
    hasMore?: boolean;
    onLoadOlder?: () => Promise<void> | void;
    loadOlderThreshold?: number;
    stickThreshold?: number;
    onStickChange?: (stuck: boolean) => void;
    scrollAwayThreshold?: number;
    onScrollAwayChange?: (away: boolean) => void;
    initialIndex?: number | null;
    class?: string;
    [key: string]: any;
  } = $props();

  const rows = $derived(data ?? items ?? []);

  let list = $state<VirtualList | null>(null);
  let isPrepend = $state(false);

  // Plain (non-reactive) scroll bookkeeping — mirrors the admin refs.
  let shouldStick = true;
  let prevLen = 0;
  let fetchingOlder = false;
  let prevAway = false;
  // False until initial positioning has been issued for the current data set (reset when the list
  // empties — e.g. a new ChatSession). Gates onLoadOlder so the mount-time onscroll(0) can't prepend
  // and shift indices out from under virtua's still-converging initial scroll.
  let ready = false;

  export function scrollToBottom() {
    if (list && rows.length) list.scrollToIndex(rows.length - 1, { align: 'end' });
  }
  export function scrollToIndex(i: number, opts?: { align?: 'start' | 'center' | 'end' }) {
    list?.scrollToIndex(i, opts);
  }
  export function stick() {
    shouldStick = true;
    scrollToBottom();
  }

  // Position the freshly-loaded window ONCE: to `initialIndex` (the unread divider, aligned to the
  // bottom of the viewport) when the host supplies a valid one, else the last message. A single
  // scrollToIndex is enough — virtua re-applies it on each row measurement until the visible range
  // is measured (core scheduler), so no manual settle loop is needed. This is the ONLY initial
  // scroll driver; the host must not also call scrollToBottom/scrollToIndex on open.
  function initialize() {
    const last = rows.length - 1;
    const target = initialIndex != null && initialIndex > 0 && initialIndex <= last ? initialIndex : last;
    shouldStick = target === last;
    list?.scrollToIndex(target, { align: 'end' });
    ready = true;
  }

  // On count change: an empty→N transition (fresh load / new session) positions once via initialize();
  // a prepend keeps position (shift); any other append sticks to bottom if we were already there.
  $effect(() => {
    const len = rows.length;
    if (len === prevLen) return;
    const wasPrepend = isPrepend;
    const wasEmpty = prevLen === 0;
    prevLen = len;
    if (len === 0) { ready = false; shouldStick = true; return; }
    tick().then(() => {
      if (wasPrepend) { isPrepend = false; return; }
      if (wasEmpty) { initialize(); return; }
      if (shouldStick) scrollToBottom();
    });
  });

  function handleScroll(offset: number) {
    if (!list) return;
    const scrollSize = list.getScrollSize();
    const viewport = list.getViewportSize();

    const stuck = offset - scrollSize + viewport >= -stickThreshold;
    if (stuck !== shouldStick) onStickChange?.(stuck);
    shouldStick = stuck;

    // "Scrolled away from bottom" for the host's scroll-to-bottom button (coarser threshold).
    const away = scrollSize - viewport - offset > scrollAwayThreshold;
    if (away !== prevAway) { prevAway = away; onScrollAwayChange?.(away); }

    // Near the top → load older items, keeping position via `shift`.
    if (ready && offset < loadOlderThreshold && !fetchingOlder && hasMore) {
      fetchingOlder = true;
      isPrepend = true;
      Promise.resolve(onLoadOlder?.()).finally(() => { fetchingOlder = false; });
    }
  }
</script>

<VirtualList
  bind:this={list}
  data={rows}
  {getKey}
  shift={isPrepend}
  onscroll={handleScroll}
  class={className}
  {...restProps}
>
  {#snippet children(item, index)}
    {@render children(item, index)}
  {/snippet}
</VirtualList>
