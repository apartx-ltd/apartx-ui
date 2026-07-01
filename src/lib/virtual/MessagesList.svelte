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

  // On count change: prepend keeps position (shift); otherwise stick to bottom
  // if we were already there.
  $effect(() => {
    const len = rows.length;
    if (len === prevLen) return;
    const wasPrepend = isPrepend;
    prevLen = len;
    if (len === 0) return;
    tick().then(() => {
      if (wasPrepend) { isPrepend = false; return; }
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
    if (offset < loadOlderThreshold && !fetchingOlder && hasMore) {
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
