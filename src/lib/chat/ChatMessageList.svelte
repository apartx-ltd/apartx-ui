<script lang="ts">
  import { tick } from 'svelte';
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import MessagesList from '../virtual/MessagesList.svelte';
  import Icon from '../ui/display/Icon.svelte';
  import Message from './Message.svelte';
  import { chatT } from './i18n';
  import { firstUnreadId, countUnread, newerWatermark } from './helpers';
  import type { ChatSession } from './session.svelte';
  import type { Message as ChatMessage } from './types';

  let {
    session, meUserId, labelFor,
    deletedLabel = chatT('chat.message_deleted', { defaultValue: 'Message deleted' }),
    unreadLabel = chatT('chat.unread_messages', { defaultValue: 'Unread messages' }),
    scrollToBottomLabel = chatT('chat.scroll_to_bottom', { defaultValue: 'Scroll to bottom' }),
    onContextMenu, menuOnClick = false, readDebounceMs = 600,
    class: className,
  }:
    {
      session: ChatSession;
      meUserId?: string;
      labelFor?: (m: ChatMessage) => { timeLabel?: string; dateLabel?: string; authorName?: string; serviceLabel?: string };
      deletedLabel?: string;
      unreadLabel?: string;
      scrollToBottomLabel?: string;
      onContextMenu?: (info: { message: ChatMessage; x: number; y: number }) => void;
      menuOnClick?: boolean;
      readDebounceMs?: number;
      /** Applied to the scroll container — hosts add horizontal padding etc. (e.g. "px-2"). */
      class?: string;
    } = $props();

  let listCmp = $state<MessagesList | null>(null);
  // Shown once scrolled away from the bottom (drives the scroll-to-bottom button).
  let showScrollDown = $state(false);

  const messages = $derived(session.messages as ChatMessage[]);
  const hasMore = $derived(session.olderStatus !== 'exhausted');
  const unreadId = $derived(firstUnreadId(messages, meUserId));
  const unreadCount = $derived(countUnread(messages, meUserId));

  // Debounce read-on-render into one markRead per readDebounceMs, watermarking by seq-or-createdAt.
  let pendingWatermark: ChatMessage | null = null;
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  function noteRead(m: ChatMessage) {
    pendingWatermark = newerWatermark(pendingWatermark, m);
    if (readTimer) return;
    readTimer = setTimeout(() => {
      readTimer = null;
      if (pendingWatermark) { session.markRead(pendingWatermark); pendingWatermark = null; }
    }, readDebounceMs);
  }

  // First load: jump to the unread divider, else the bottom (MessagesList sticks to bottom by default).
  let initialScrollDone = false;
  $effect(() => {
    if (initialScrollDone || session.status !== 'ready' || !messages.length || !listCmp) return;
    initialScrollDone = true;
    const idx = unreadId ? messages.findIndex((m) => m._id === unreadId) : -1;
    tick().then(() => { if (idx > 0) listCmp!.scrollToIndex(idx, { align: 'end' }); });
  });

  export function scrollToBottom() { listCmp?.scrollToBottom(); }
</script>

<div class="relative h-full min-h-0">
  <MessagesList
    bind:this={listCmp}
    class={className}
    data={messages}
    getKey={(m) => m._id}
    hasMore={hasMore}
    onLoadOlder={() => session.loadOlder()}
    onScrollAwayChange={(away) => (showScrollDown = away)}
  >
    {#snippet children(m, i)}
      {@const labels = labelFor?.(m) ?? {}}
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
        {onContextMenu}
        {menuOnClick}
        onRead={noteRead}
      />
    {/snippet}
  </MessagesList>

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
