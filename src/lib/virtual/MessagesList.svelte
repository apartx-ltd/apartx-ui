<script lang="ts">
  import { tick } from 'svelte';
  import VirtualList from './VirtualList.svelte';

  /**
   * Messages/feed preset over `VirtualList`. The virtua Svelte adapter has no
   * `reverse` prop, so bottom-anchored behaviour is driven manually via
   * `scrollToIndex(last, { align: 'end' })`, and `shift` keeps the scroll
   * position when older items are prepended.
   *
   * ## Positioning model (the part that makes it deterministic)
   *
   * virtua is top-anchored and measures row heights asynchronously AFTER paint, so during load the
   * scroll geometry lies: every late reflow (an image decoding, a font swap, the on-screen keyboard)
   * momentarily reads as "not at the bottom". Deriving the stuck-state from geometry therefore races
   * the very reflows it should correct. Instead:
   *
   * - `pinned` — "we owe the user the bottom". While pinned, ANY change in the world (content
   *   height, viewport height, appended rows) re-asserts the bottom. ONLY a user gesture (wheel /
   *   touch / scrollbar / keys — tracked via a gesture window closed by scrollend) or the imperative
   *   `stick()` may flip it; geometry observed outside a gesture never does.
   * - `settling` — from the first data until the content height is frame-stable (hard cap
   *   SETTLE_MAX_MS). The list is hidden (`visibility:hidden` — layout and virtua's ResizeObserver
   *   measurements still run) and every resize unconditionally re-asserts the target, so the reveal
   *   shows the exact landing position with zero visible jumping.
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
    /** Fired when the settle phase completes (true) or a new one begins (false) — lets the host
     *  show a loading indicator over the still-hidden list instead of a blank pane. */
    onSettledChange,
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
    onSettledChange?: (settled: boolean) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  const rows = $derived(data ?? items ?? []);

  let list = $state<VirtualList | null>(null);
  let isPrepend = $state(false);

  // Settle phase needs enough frames for virtua's async measurements to converge, but must not
  // keep the user staring at a blank pane — the cap doubles as the safety net for throttled rAF.
  const SETTLE_STABLE_FRAMES = 3;
  const SETTLE_MAX_MS = 400;
  // A gesture with no resulting scroll (e.g. wheel-down while already at the bottom) must not leave
  // the window open for a later reflow-induced scroll to be misread as the user.
  const GESTURE_IDLE_MS = 300;

  // Plain (non-reactive) scroll bookkeeping.
  let pinned = true;
  let gestureWindow = false;
  let gestureTimer: ReturnType<typeof setTimeout> | null = null;
  let settling = false;
  let settleRaf = 0;
  let settleCap: ReturnType<typeof setTimeout> | null = null;
  let prevLen = 0;
  let fetchingOlder = false;
  let prevAway = false;

  // Hidden until the first settle completes (reset when the list empties — a new session).
  let settled = $state(false);

  function setSettled(v: boolean) {
    if (settled === v) return;
    settled = v;
    onSettledChange?.(v);
  }

  function setPinned(v: boolean) {
    if (pinned === v) return;
    pinned = v;
    onStickChange?.(v);
  }

  export function scrollToBottom() {
    if (list && rows.length) list.scrollToIndex(rows.length - 1, { align: 'end' });
  }
  export function scrollToIndex(i: number, opts?: { align?: 'start' | 'center' | 'end' }) {
    list?.scrollToIndex(i, opts);
  }
  export function stick() {
    setPinned(true);
    scrollToBottom();
  }

  // Land on `initialIndex` (the unread divider, aligned to the bottom of the viewport) when the
  // host supplies a valid one, else the last row. Re-read from current props on every call — data
  // may still be arriving in chunks while settling.
  function assertTarget() {
    const last = rows.length - 1;
    if (last < 0) return;
    const target = initialIndex != null && initialIndex > 0 && initialIndex <= last ? initialIndex : last;
    setPinned(target === last);
    list?.scrollToIndex(target, { align: 'end' });
  }

  function cancelSettleWatch() {
    if (settleRaf) cancelAnimationFrame(settleRaf);
    settleRaf = 0;
    if (settleCap) clearTimeout(settleCap);
    settleCap = null;
  }

  // Watch getScrollSize() across frames: stable for SETTLE_STABLE_FRAMES ⇒ virtua's measurements
  // have converged and the asserted target is final ⇒ reveal.
  function beginSettle() {
    settling = true;
    setSettled(false);
    assertTarget();
    cancelSettleWatch();
    let stable = 0;
    let lastSize = -1;
    const frame = () => {
      if (!settling) return;
      const size = list?.getScrollSize() ?? -1;
      if (size === lastSize) stable++;
      if (size !== lastSize) { stable = 0; lastSize = size; }
      if (stable >= SETTLE_STABLE_FRAMES) { finishSettle(); return; }
      settleRaf = requestAnimationFrame(frame);
    };
    settleRaf = requestAnimationFrame(frame);
    settleCap = setTimeout(finishSettle, SETTLE_MAX_MS);
  }

  function finishSettle() {
    cancelSettleWatch();
    if (!settling) { setSettled(true); return; }
    settling = false;
    setSettled(true);
    if (pinned) scrollToBottom();
  }

  // On count change: an empty→N transition (fresh load / new session) enters the settle phase;
  // a self-initiated prepend keeps position (shift); anything else while pinned re-asserts the
  // bottom. While settling, chunked loads (offline-first stores deliver in bursts) re-assert
  // the target instead.
  $effect(() => {
    const len = rows.length;
    if (len === prevLen) return;
    const wasPrepend = isPrepend;
    const wasEmpty = prevLen === 0;
    prevLen = len;
    if (len === 0) {
      settling = false;
      setSettled(false);
      cancelSettleWatch();
      setPinned(true);
      return;
    }
    tick().then(() => {
      if (wasPrepend) { isPrepend = false; return; }
      if (wasEmpty) { beginSettle(); return; }
      if (settling) { assertTarget(); return; }
      if (pinned) scrollToBottom();
    });
  });

  // Content OR viewport height changed without a scroll (media decoded, keyboard opened…):
  // virtua keeps the top offset, so a bottom-pinned list would silently drift up. Re-assert.
  // Geometry can't unpin (see handleScroll), so this always wins — no race. Positioning goes
  // through virtua's own scrollToIndex ONLY: writing scrollTop directly desyncs virtua's internal
  // offset and its deferred compensation then fights the pin (oscillation) — the estimate→measured
  // correction churn is instead removed at the source by the `cacheKey` measured-size reuse.
  function handleContentResize() {
    if (settling) { assertTarget(); return; }
    if (pinned) scrollToBottom();
  }

  // --- User-gesture window: the ONLY thing allowed to change `pinned` via geometry. Opened by an
  // input event on the list, kept open while scroll events keep arriving, closed by scrollend
  // (virtua synthesizes it cross-browser) or GESTURE_IDLE_MS of quiescence.
  function armGestureTimer() {
    if (gestureTimer) clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => { gestureWindow = false; }, GESTURE_IDLE_MS);
  }
  function openGestureWindow() {
    // The user grabbed the list — their intent overrides the settle phase.
    if (settling) finishSettle();
    gestureWindow = true;
    armGestureTimer();
  }
  function handleScrollEnd() {
    gestureWindow = false;
    if (gestureTimer) clearTimeout(gestureTimer);
    gestureTimer = null;
  }

  function handleScroll(offset: number) {
    if (!list) return;
    const scrollSize = list.getScrollSize();
    const viewport = list.getViewportSize();

    // Geometry may flip `pinned` ONLY while the user is actually interacting. Reflow-induced
    // scroll events (virtua's jump compensation, late measurements) land outside the window
    // and must not: during load they'd read as "not at the bottom" and strand the list.
    if (gestureWindow) {
      armGestureTimer();
      setPinned(offset - scrollSize + viewport >= -stickThreshold);
    }

    // "Scrolled away from bottom" for the host's scroll-to-bottom button (coarser threshold).
    const away = scrollSize - viewport - offset > scrollAwayThreshold;
    if (away !== prevAway) { prevAway = away; onScrollAwayChange?.(away); }

    // Near the top → load older items, keeping position via `shift`. Gated on `settled` so the
    // mount-time onscroll(0) can't prepend and shift indices under the initial positioning.
    if (settled && offset < loadOlderThreshold && !fetchingOlder && hasMore) {
      fetchingOlder = true;
      isPrepend = true;
      Promise.resolve(onLoadOlder?.()).finally(() => { fetchingOlder = false; });
    }
  }
</script>

<!-- display:contents — no box, so the scroller's layout/measurement is untouched; visibility (an
     inherited property) and the gesture listeners still apply through it. Hidden until settled.
     Not an interactive element: the handlers only OBSERVE bubbling input to open the gesture
     window (scrolling itself stays native), hence the a11y ignore. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="display:contents; visibility:{settled ? 'visible' : 'hidden'}"
  onwheel={openGestureWindow}
  ontouchstart={openGestureWindow}
  ontouchmove={openGestureWindow}
  onpointerdown={openGestureWindow}
  onkeydown={openGestureWindow}
>
  <VirtualList
    bind:this={list}
    data={rows}
    {getKey}
    shift={isPrepend}
    onscroll={handleScroll}
    onscrollend={handleScrollEnd}
    onContentResize={handleContentResize}
    class={className}
    {...restProps}
  >
    {#snippet children(item, index)}
      {@render children(item, index)}
    {/snippet}
  </VirtualList>
</div>
