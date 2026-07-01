<script lang="ts">
  import type { Message } from './types';
  import MessageRenderer from './MessageRenderer.svelte';
  import { groupStart, showDate } from './helpers';

  let {
    message, prev = null, meUserId,
    authorName = '', timeLabel = '', dateLabel = '', serviceLabel = '',
    deletedLabel = 'Message deleted', unreadLabel = 'Unread messages',
    isUnread = false, onContextMenu, menuOnClick = false, onRead,
  }:
    {
      message: Message; prev?: Message | null; meUserId?: string;
      authorName?: string; timeLabel?: string; dateLabel?: string;
      /** Host-translated text for a `type==='service'` system note (rendered centered). Falls back to message.text. */
      serviceLabel?: string;
      deletedLabel?: string; unreadLabel?: string; isUnread?: boolean;
      onContextMenu?: (info: { message: Message; x: number; y: number }) => void;
      menuOnClick?: boolean;
      onRead?: (m: Message) => void;
    } = $props();

  const mine = $derived(!!meUserId && message.userId === meUserId);
  const removed = $derived(!!message.removedAt);
  const isService = $derived(message.type === 'service');
  const isGroupStart = $derived(groupStart(message, prev));
  const separator = $derived(showDate(message, prev));

  // Read-on-render: notify when an incoming, unread message mounts. Skip soft-deleted + service (no unread weight).
  $effect(() => {
    if (!message || mine || removed || isService || !onRead) return;
    if (message.read === true) return;
    if (Array.isArray(message.read) && message.read.includes(meUserId ?? '')) return;
    onRead(message);
  });

  function openMenu(e: MouseEvent) {
    e.preventDefault();
    onContextMenu?.({ message, x: e.clientX, y: e.clientY });
  }
</script>

{#if separator}
  <div class="my-2 text-center text-xs text-on-surface-variant">{dateLabel}</div>
{/if}

{#if isUnread}
  <div class="my-1 text-center text-xs text-on-surface-variant bg-surface-container rounded-lg py-1">{unreadLabel}</div>
{/if}

{#if isService}
  <div class="my-1 text-center text-body-sm text-on-surface-variant">{serviceLabel || message.text || ''}</div>
{:else}
<div class="flex {mine ? 'justify-end' : 'justify-start'} {isGroupStart ? 'mt-2' : 'mt-0.5'}">
  {#if removed}
    <div class="max-w-[80%] rounded-2xl border border-outline-variant px-3 py-1.5 text-sm italic text-on-surface-variant">
      {deletedLabel}
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="max-w-[80%] rounded-2xl px-3 py-1.5 {mine ? 'bg-primary-container' : 'bg-surface-container'}"
      oncontextmenu={onContextMenu ? openMenu : undefined}
      onclick={menuOnClick && onContextMenu ? openMenu : undefined}
    >
      <MessageRenderer {message} {meUserId} {authorName} {timeLabel} {isGroupStart} />
    </div>
  {/if}
</div>
{/if}
