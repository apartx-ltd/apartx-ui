<script lang="ts">
  import { tick } from 'svelte';
  import MessagesList from '../virtual/MessagesList.svelte';
  import Message from './Message.svelte';
  import { chatT } from './i18n';
  import { firstUnreadId, newerWatermark } from './helpers';
  import type { ChatSession } from './session.svelte';
  import type { Message as ChatMessage } from './types';

  let {
    session, meUserId, labelFor,
    deletedLabel = chatT('chat.message_deleted', { defaultValue: 'Message deleted' }),
    unreadLabel = chatT('chat.unread_messages', { defaultValue: 'Unread messages' }),
    onContextMenu, menuOnClick = false, readDebounceMs = 600,
    class: className,
  }:
    {
      session: ChatSession;
      meUserId?: string;
      labelFor?: (m: ChatMessage) => { timeLabel?: string; dateLabel?: string; authorName?: string; serviceLabel?: string };
      deletedLabel?: string;
      unreadLabel?: string;
      onContextMenu?: (info: { message: ChatMessage; x: number; y: number }) => void;
      menuOnClick?: boolean;
      readDebounceMs?: number;
      /** Applied to the scroll container — hosts add horizontal padding etc. (e.g. "px-2"). */
      class?: string;
    } = $props();

  let listCmp = $state<MessagesList | null>(null);

  const messages = $derived(session.messages as ChatMessage[]);
  const hasMore = $derived(session.olderStatus !== 'exhausted');
  const unreadId = $derived(firstUnreadId(messages, meUserId));

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

<MessagesList
  bind:this={listCmp}
  class={className}
  data={messages}
  getKey={(m) => m._id}
  hasMore={hasMore}
  onLoadOlder={() => session.loadOlder()}
>
  {#snippet children(m, i)}
    {@const labels = labelFor?.(m) ?? {}}
    <Message
      message={m}
      prev={messages[i - 1] ?? null}
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
