<script lang="ts">
  import type { Message } from './types';
  import MessageRenderer from './MessageRenderer.svelte';
  import { groupStart, showDate } from './helpers';

  let { message, prev = null, meUserId, authorName = '', timeLabel = '', dateLabel = '', deletedLabel = 'Message deleted', onRead }:
    {
      message: Message; prev?: Message | null; meUserId?: string;
      authorName?: string; timeLabel?: string; dateLabel?: string; deletedLabel?: string;
      onRead?: (m: Message) => void;
    } = $props();

  const mine = $derived(!!meUserId && message.userId === meUserId);
  const removed = $derived(!!message.removedAt);
  const isGroupStart = $derived(groupStart(message, prev));
  const separator = $derived(showDate(message, prev));

  // Read-on-render: notify when an incoming, unread message mounts. The host (via ChatMessageList) debounces these
  // into a single markRead(watermark) server call. Soft-deleted messages carry no unread weight — skip them.
  $effect(() => {
    if (!message || mine || removed || !onRead) return;
    if (message.read === true) return;
    if (Array.isArray(message.read) && message.read.includes(meUserId ?? '')) return;
    onRead(message);
  });
</script>

{#if separator}
  <div class="my-2 text-center text-xs text-on-surface-variant">{dateLabel}</div>
{/if}

<div class="flex {mine ? 'justify-end' : 'justify-start'} {isGroupStart ? 'mt-2' : 'mt-0.5'}">
  {#if removed}
    <div class="max-w-[80%] rounded-2xl border border-outline-variant px-3 py-1.5 text-sm italic text-on-surface-variant">
      {deletedLabel}
    </div>
  {:else}
    <div class="max-w-[80%] rounded-2xl px-3 py-1.5 {mine ? 'bg-primary-container' : 'bg-surface-container'}">
      <MessageRenderer {message} {meUserId} {authorName} {timeLabel} />
    </div>
  {/if}
</div>
