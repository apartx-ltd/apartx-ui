<script lang="ts">
  import type { Message } from './types';
  import MessageRenderer from './MessageRenderer.svelte';
  import { groupStart, groupEnd, showDate, isFullBleedMedia } from './helpers';
  import { resolveComponents } from './registry.svelte';

  let {
    message, prev = null, next = null, meUserId,
    authorName = '', timeLabel = '', dateLabel = '', serviceLabel = '',
    deletedLabel = 'Message deleted', unreadLabel = 'Unread messages',
    isUnread = false, onContextMenu, menuOnClick = false, onRead, readByMe = false,
  }:
    {
      message: Message; prev?: Message | null; next?: Message | null; meUserId?: string;
      authorName?: string; timeLabel?: string; dateLabel?: string;
      /** Host-translated text for a `type==='service'` system note (rendered centered). Falls back to message.text. */
      serviceLabel?: string;
      deletedLabel?: string; unreadLabel?: string; isUnread?: boolean;
      onContextMenu?: (info: { message: Message; x: number; y: number }) => void;
      menuOnClick?: boolean;
      onRead?: (m: Message) => void;
      readByMe?: boolean;
    } = $props();

  const mine = $derived(!!meUserId && message.userId === meUserId);
  const removed = $derived(!!message.removedAt);
  const isService = $derived(message.type === 'service');
  const isGroupStart = $derived(groupStart(message, prev));
  const isGroupEnd = $derived(groupEnd(message, next));
  const separator = $derived(showDate(message, prev));

  // Telegram-style full-bleed media bubble: image/video fills the bubble edge-to-edge (the bubble
  // drops its padding + clips corners; the renderer pads any header above / caption below and floats
  // the time over the media when there's no caption). Audio/document and text keep the padded bubble.
  const slots = $derived(resolveComponents(message.type));
  const fullBleed = $derived(!removed && !isService && !!slots.media && isFullBleedMedia(message.type));

  // Group-aware corner squaring: on the speaker's side (right for me, left for others) square the top
  // corner when this isn't the group's first message and the bottom corner when it isn't the last, so a
  // run of same-author messages reads as one stacked block. Mirrors the pre-kit shell's bubbleRadius.
  const bubbleRadius = $derived.by(() => {
    const cls = ['rounded-2xl'];
    if (mine) {
      if (!isGroupStart) cls.push('rounded-tr-sm');
      if (!isGroupEnd) cls.push('rounded-br-sm');
    } else {
      if (!isGroupStart) cls.push('rounded-tl-sm');
      if (!isGroupEnd) cls.push('rounded-bl-sm');
    }
    return cls.join(' ');
  });

  // Read-on-render: notify when an incoming, unread message mounts. Skip soft-deleted + service (no unread weight).
  $effect(() => {
    if (!message || mine || removed || isService || !onRead) return;
    if (readByMe) return;
    onRead(message);
  });

  function openMenu(e: MouseEvent) {
    if (removed) return; // soft-deleted messages have no menu (matches the pre-full-row behaviour)
    e.preventDefault();
    onContextMenu?.({ message, x: e.clientX, y: e.clientY });
  }
</script>

{#if separator}
  <div class="my-2 text-center text-xs text-on-surface-variant">{dateLabel}</div>
{/if}

{#if isUnread}
  <div data-testid="chat-unread-divider" class="my-1 text-center text-xs text-on-surface-variant bg-surface-container rounded-lg py-1">{unreadLabel}</div>
{/if}

{#if isService}
  <div class="my-1 text-center text-body-sm text-on-surface-variant">{serviceLabel || message.text || ''}</div>
{:else}
<!-- Telegram-style menu target: the whole ROW is tappable (menuOnClick), so a tap on the small bubble
     OR in the empty gutter across from it opens the menu — "as if the message spanned full width". Media
     slots stopPropagation their own tap so tapping a photo/video opens the viewer instead of the menu. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  data-message-id={message._id} data-testid="chat-message"
  class="flex {mine ? 'justify-end' : 'justify-start'} {isGroupStart ? 'mt-2' : 'mt-0.5'}"
  onclick={menuOnClick && onContextMenu ? openMenu : undefined}
>
  {#if removed}
    <div class="max-w-[80%] rounded-2xl border border-outline-variant px-3 py-1.5 text-sm italic text-on-surface-variant">
      {deletedLabel}
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="max-w-[80%] {bubbleRadius} {fullBleed ? 'overflow-hidden' : 'px-2 py-1.5'} {mine ? 'bg-primary-container' : 'bg-surface-container'}"
      oncontextmenu={onContextMenu ? openMenu : undefined}
    >
      <MessageRenderer {message} {meUserId} {authorName} {timeLabel} {isGroupStart} {isGroupEnd} {fullBleed} />
    </div>
  {/if}
</div>
{/if}
