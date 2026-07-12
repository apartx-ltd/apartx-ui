<script lang="ts">
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import MessagesList from '../virtual/MessagesList.svelte';
  import { cn } from '../ui/utils/cn';
  import Icon from '../ui/display/Icon.svelte';
  import Loading from '../ui/display/Loading.svelte';
  import Message from './Message.svelte';
  import { chatT } from './i18n';
  import { countUnread, createReadFlusher } from './helpers';
  import { isReadByMe } from './replication/read-state';
  import type { ChatSession } from './session.svelte';
  import type { Message as ChatMessage } from './types';

  let {
    session, meUserId, lastReadSeq = null, labelFor,
    deletedLabel = chatT('chat.message_deleted', { defaultValue: 'Message deleted' }),
    unreadLabel = chatT('chat.unread_messages', { defaultValue: 'Unread messages' }),
    scrollToBottomLabel = chatT('chat.scroll_to_bottom', { defaultValue: 'Scroll to bottom' }),
    onContextMenu, menuOnClick = false, readDebounceMs = 600,
    class: className,
  }:
    {
      session: ChatSession;
      meUserId?: string;
      lastReadSeq?: number | null;
      labelFor?: (m: ChatMessage) => { timeLabel?: string; dateLabel?: string; authorName?: string; serviceLabel?: string };
      deletedLabel?: string;
      unreadLabel?: string;
      scrollToBottomLabel?: string;
      onContextMenu?: (info: { message: ChatMessage; x: number; y: number }) => void;
      menuOnClick?: boolean;
      readDebounceMs?: number;
      /** Merged over the scroll container's defaults (kit default `px-2`) via `cn`/tailwind-merge —
       *  a consumer's conflicting utility wins (e.g. pass `px-4` or `px-0` to override the padding). */
      class?: string;
    } = $props();

  let listCmp = $state<MessagesList | null>(null);
  // Shown once scrolled away from the bottom (drives the scroll-to-bottom button).
  let showScrollDown = $state(false);
  // While MessagesList runs its hidden settle phase (initial data + measurements converging) the
  // list pane is visually empty — show a spinner instead of a blank pane (noticeable on mobile,
  // where the fetch + settle can take most of a second).
  let revealed = $state(false);

  const messages = $derived(session.messages as ChatMessage[]);
  const hasMore = $derived(session.olderStatus !== 'exhausted');
  // Divider anchor is FROZEN at open() by the session — it marks where you left off on entry and
  // does not chase live messages (which get read on render). See ChatSession.unreadAnchorId.
  const unreadId = $derived(session.unreadAnchorId);
  const unreadCount = $derived(countUnread(messages, meUserId, lastReadSeq));
  // Where MessagesList should land on first load: the unread divider if there is one, else −1
  // (MessagesList treats < 1 as "bottom"). This is the ONLY initial-scroll signal — MessagesList
  // owns the actual scroll so there is a single, race-free driver.
  const initialIndex = $derived(unreadId ? messages.findIndex((m) => m._id === unreadId) : -1);

  // Debounce read-on-render into one markRead per readDebounceMs, GATED on "the user is actually viewing
  // THIS window" (visible AND focused). The virtualizer mounts an off-screen overscan buffer and sticks to
  // the bottom, so a message arriving while the tab is backgrounded — or while the window is visible but
  // sits behind another (overlapping windows both report visibilityState 'visible'; only focus tells them
  // apart) — would otherwise be marked read though nobody looked at it. createReadFlusher records the newest
  // rendered unread regardless and withholds the server markRead until focus/visibility returns.
  const isViewing = () =>
    typeof document === 'undefined' || (document.visibilityState === 'visible' && document.hasFocus());
  const flusher = createReadFlusher({
    markRead: (m) => session.markRead(m),
    isViewing,
    debounceMs: readDebounceMs,
  });
  const noteRead = (m: ChatMessage) => flusher.note(m);
  // Returning to the window (tab foregrounded / window re-focused) flushes whatever accumulated while away.
  $effect(() => {
    if (typeof document === 'undefined') return;
    const onView = () => flusher.flushIfViewing();
    document.addEventListener('visibilitychange', onView);
    window.addEventListener('focus', onView);
    return () => {
      document.removeEventListener('visibilitychange', onView);
      window.removeEventListener('focus', onView);
      flusher.dispose();
    };
  });

  export function scrollToBottom() { listCmp?.scrollToBottom(); }
</script>

<div class="relative h-full min-h-0">
  <MessagesList
    bind:this={listCmp}
    class={cn('px-2', className)}
    data={messages}
    getKey={(m) => m._id}
    cacheKey={`chat:${session.chatId}`}
    hasMore={hasMore}
    onLoadOlder={() => session.loadOlder()}
    {initialIndex}
    onScrollAwayChange={(away) => (showScrollDown = away)}
    onSettledChange={(s) => (revealed = s)}
  >
    {#snippet children(m, i)}
      {@const labels = labelFor?.(m) ?? {}}
      <!-- Bottom gap lives on the LAST item (measured by virtua) — padding the scroll viewport
           instead would inflate getScrollSize() and break stick-to-bottom / scroll-away detection. -->
      <div class={i === messages.length - 1 ? 'pb-2' : undefined}>
      <Message
        message={m}
        prev={messages[i - 1] ?? null}
        next={messages[i + 1] ?? null}
        {meUserId}
        authorName={labels.authorName ?? ''}
        timeLabel={labels.timeLabel ?? ''}
        dateLabel={labels.dateLabel ?? ''}
        serviceLabel={labels.serviceLabel ?? ''}
        {deletedLabel}
        {unreadLabel}
        isUnread={m._id === unreadId}
        readByMe={isReadByMe(m as any, meUserId ?? '', lastReadSeq)}
        {onContextMenu}
        {menuOnClick}
        onRead={noteRead}
      />
      </div>
    {/snippet}
  </MessagesList>

  <!-- Spinner while the pane is visually empty: initial fetch in flight (no rows yet, but more to
       come) or rows present but still in the hidden settle phase. A genuinely EMPTY chat (0 rows,
       history exhausted) never settles — the condition falls through and the pane stays clean. -->
  {#if !revealed && (messages.length > 0 || hasMore)}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <Loading />
    </div>
  {/if}

  {#if showScrollDown}
    <button
      type="button"
      class="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant shadow-level-2 hover:bg-on-surface/8"
      onclick={() => listCmp?.stick()}
      aria-label={scrollToBottomLabel}
    >
      <Icon icon={faChevronDown} />
      {#if unreadCount > 0}
        <span class="absolute -top-1.5 left-1/2 h-[18px] min-w-[18px] -translate-x-1/2 rounded-full bg-primary px-1 text-center text-[10px] leading-[18px] text-on-primary">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </button>
  {/if}
</div>
