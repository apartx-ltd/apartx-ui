<script lang="ts">
  import MessagesList from '../virtual/MessagesList.svelte';
  import Message from './Message.svelte';
  import { chatT } from './i18n';
  import type { ChatSession } from './session.svelte';
  import type { Message as ChatMessage } from './types';

  let { session, meUserId, labelFor, deletedLabel = chatT('chat.message_deleted', { defaultValue: 'Message deleted' }), readDebounceMs = 600 }:
    {
      session: ChatSession;
      meUserId?: string;
      /** Per-message label provider (host formats time/date/author with its i18n). */
      labelFor?: (m: ChatMessage) => { timeLabel?: string; dateLabel?: string; authorName?: string };
      /** Placeholder shown in place of a soft-deleted message's body. */
      deletedLabel?: string;
      readDebounceMs?: number;
    } = $props();

  let listCmp = $state<MessagesList | null>(null);

  const messages = $derived(session.messages as ChatMessage[]);
  const hasMore = $derived(session.olderStatus !== 'exhausted');

  // Debounce read-on-render: track the max seq seen, flush one markRead per readDebounceMs.
  let pendingMaxSeq = 0;
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  function noteRead(m: ChatMessage) {
    if (m.seq && m.seq > pendingMaxSeq) pendingMaxSeq = m.seq;
    if (readTimer) return;
    readTimer = setTimeout(() => {
      readTimer = null;
      if (pendingMaxSeq > 0) session.markRead(pendingMaxSeq);
    }, readDebounceMs);
  }

  export function scrollToBottom() { listCmp?.scrollToBottom(); }
</script>

<MessagesList
  bind:this={listCmp}
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
      {deletedLabel}
      onRead={noteRead}
    />
  {/snippet}
</MessagesList>
