<script lang="ts">
  // Shared chat-list row: avatar, name + marker icons, last-message preview (group sender line +
  // preview + optional warning), and the right rail (4-state delivery tick, time, unread chip,
  // messenger source icon).
  //
  // Kit-agnostic: all user-facing TEXT is precomputed by the host and passed as props (displayName,
  // senderLabel, previewText, timeLabel, warningText, missingText) so the kit stays i18n-free. The
  // host also owns dialog fetching; this component only renders + emits click/context/remove.
  // Product knowledge is the host's too: the default avatar is the counterpart's profile picture
  // and there are no markers — a host that wants a booking photo with the profile overlaid, or
  // role/booking icons next to the name, passes the `avatar` / `markers` snippets.
  import type { Snippet } from 'svelte';
  import { Avatar, Badge, Icon } from '../ui/display';
  import {
    faTrash, faExclamationTriangle, faCheckDouble, faCheck, faClock,
  } from '@fortawesome/free-solid-svg-icons';
  import { longpress } from '../hooks/useLongPress.svelte';
  import MessengerIcon from './slots/MessengerIcon.svelte';
  import { deliveryTick } from './helpers';

  let {
    dialog,
    meUserId,
    isSelected = false,
    displayName = '',
    senderLabel = '',
    previewText = '',
    timeLabel = '',
    warningText = '',
    missingText = 'Chat does not exist',
    divider = true,
    avatar,
    markers,
    onClick,
    onContextTrigger,
    onRemove,
  }: {
    dialog: any;
    meUserId?: string;
    isSelected?: boolean;
    displayName?: string;
    senderLabel?: string;
    previewText?: string;
    timeLabel?: string;
    warningText?: string;
    missingText?: string;
    divider?: boolean;
    /** Replaces the default profile avatar (a 48px circle); receives the dialog and its profile. */
    avatar?: Snippet<[{ dialog: any; profile: any; displayName: string }]>;
    /** Icons rendered right after the name (role, booking kind, …); nothing by default. */
    markers?: Snippet<[{ dialog: any; profile: any; chat: any }]>;
    onClick?: (d: any) => void;
    onContextTrigger?: (d: any, clientX: number, clientY: number) => void;
    onRemove?: (d: any) => void;
  } = $props();

  const profile = $derived(dialog?.profile ?? {});
  const chat = $derived(dialog?.chat);
  const lastMessage = $derived(chat?.lastMessage);

  // 4-state tick for MY last message (same model as the open chat's MessageTimeDefault):
  // pending → clock, sent → single grey, delivered → double grey, read → double blue, failed →
  // warning. null for incoming messages (no receipt shown on the counterpart's message).
  const tick = $derived(
    lastMessage && meUserId && lastMessage.userId === meUserId
      ? deliveryTick(lastMessage, meUserId, dialog.counterpartReadSeq, dialog.counterpartDeliveredSeq)
      : null,
  );
</script>

{#if !chat}
  <div class="flex items-center bg-surface pl-2 pr-14">
    <span class="flex-grow">{missingText}</span>
    <button type="button" class="absolute right-2 text-error" onclick={() => onRemove?.(dialog)}>
      <Icon icon={faTrash} />
    </button>
  </div>
  {#if divider}<div class="h-0.5 bg-outline-variant"></div>{/if}
{:else}
  <div data-dialog-id={dialog._id} data-testid="chat-list-item">
    <div
      use:longpress={{
        onClick: () => onClick?.(dialog),
        onTrigger: ({ clientX, clientY }) => onContextTrigger?.(dialog, clientX, clientY),
      }}
      class="flex cursor-pointer items-center gap-2 py-1 pl-2 pr-14 {isSelected
        ? 'bg-secondary-container'
        : 'bg-surface'}"
    >
      <!-- avatar: host snippet, or the counterpart's profile avatar -->
      <div class="flex flex-shrink-0 items-center">
        {#if avatar}
          {@render avatar({ dialog, profile, displayName })}
        {:else}
          <Avatar src={profile.avatarUrl} fallback={profile.initials} alt={displayName} size="lg" class="size-12" />
        {/if}
      </div>

      <!-- text -->
      <div class="min-w-0 flex-grow">
        <div class="flex items-center gap-1 truncate leading-tight">
          <span class="truncate">{displayName}</span>
          {@render markers?.({ dialog, profile, chat })}
        </div>
        <div class="flex flex-col text-body-sm leading-tight text-on-surface-variant">
          {#if chat.type === 'group' && senderLabel}
            <span class="truncate text-on-surface">{senderLabel}</span>
          {/if}
          <span class="truncate">{previewText}</span>
          {#if warningText}
            <span class="mt-0.5 text-error">
              <Icon icon={faExclamationTriangle} />
              {warningText}
            </span>
          {/if}
        </div>
      </div>

      <!-- right rail -->
      <div class="absolute right-0 flex h-full flex-col justify-between p-1">
        {#if lastMessage}
          <div class="text-right text-label-sm text-on-surface-variant" data-tick={tick}>
            {#if tick === 'failed'}
              <Icon icon={faExclamationTriangle} class="mr-0.5 text-error" />
            {:else if tick === 'read'}
              <Icon icon={faCheckDouble} class="mr-0.5 text-primary" />
            {:else if tick === 'delivered'}
              <Icon icon={faCheckDouble} class="mr-0.5" />
            {:else if tick === 'sent'}
              <Icon icon={faCheck} class="mr-0.5" />
            {:else if tick === 'pending'}
              <Icon icon={faClock} class="mr-0.5" />
            {/if}
            {timeLabel}
          </div>
        {/if}
        <div class="flex items-center justify-end gap-1">
          {#if dialog.unread > 0}<Badge>{dialog.unread}</Badge>{/if}
          <MessengerIcon message={lastMessage} />
        </div>
      </div>
    </div>
    {#if divider}<div class="h-px bg-outline-variant"></div>{/if}
  </div>
{/if}
