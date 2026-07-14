<script lang="ts">
  // Shared chat-list row: avatar (booking image with profile overlay, or plain profile avatar),
  // name + role/booking marker icons, last-message preview (group sender line + preview + optional
  // warning), and the right rail (4-state delivery tick, time, unread chip, messenger source icon).
  //
  // Kit-agnostic: all user-facing TEXT is precomputed by the host and passed as props (displayName,
  // senderLabel, previewText, timeLabel, warningText, missingText) so the kit stays i18n-free. The
  // host also owns dialog fetching; this component only renders + emits click/context/remove.
  import { Avatar, Badge, Icon } from '../ui/display';
  import {
    faTrash, faKey, faHotel, faHouse, faUser, faBroom, faCalendarDays,
    faExclamationTriangle, faCheckDouble, faCheck, faClock,
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
    onClick?: (d: any) => void;
    onContextTrigger?: (d: any, clientX: number, clientY: number) => void;
    onRemove?: (d: any) => void;
  } = $props();

  const profile = $derived(dialog?.profile ?? {});
  const chat = $derived(dialog?.chat);
  const lastMessage = $derived(chat?.lastMessage);

  // Booking rows: property photo, or an icon tile when the property has none (the snapshot
  // carries an empty images list) or the photo fails to load (stale/broken URL) — tracked per
  // URL so a later snapshot update with a fresh photo retries the <img>.
  const bookingImage = $derived(chat?.booking?.property?.images?.[0]);
  let failedBookingImage = $state(null);

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
      <!-- avatar: booking image with a small profile overlay, or a plain profile avatar -->
      <div class="flex flex-shrink-0 items-center">
        {#if chat.booking}
          <div class="relative h-[50px] w-[50px]">
            {#if bookingImage && failedBookingImage !== bookingImage}
              <img
                src={bookingImage}
                alt={displayName}
                class="h-[50px] w-[50px] rounded-lg object-cover"
                onerror={() => { failedBookingImage = bookingImage; }}
              />
            {:else}
              <div
                data-testid="booking-image-fallback"
                class="flex h-[50px] w-[50px] items-center justify-center rounded-lg bg-primary-container text-on-primary-container"
              >
                <Icon icon={faHouse} size="lg" />
              </div>
            {/if}
            <!-- flex: a plain div wraps the inline-flex avatar in a line box whose strut leaves a
                 ~7px baseline gap under the circle — the avatar must sit flush with the photo edge -->
            <div class="absolute bottom-0 right-0 flex">
              <Avatar src={profile.avatarUrl} fallback={profile.initials} alt={displayName} size="sm" />
            </div>
          </div>
        {:else}
          <Avatar src={profile.avatarUrl} fallback={profile.initials} alt={displayName} size="lg" class="size-12" />
        {/if}
      </div>

      <!-- text -->
      <div class="min-w-0 flex-grow">
        <div class="flex items-center gap-1 truncate leading-tight">
          <span class="truncate">{displayName}</span>
          {#if profile.isSystemUser}
            <Icon icon={faKey} size="xs" class="text-primary" />
          {:else if chat.tenantUserId === meUserId && chat.landlordUserId}
            <Icon icon={faHotel} class="text-primary" />
          {:else if chat.tenantUserId}
            <Icon icon={faUser} class={chat.landlordUserId !== meUserId ? 'text-warning' : 'text-primary'} />
          {/if}
          {#if chat.booking}
            {#if chat.booking.type === 'cleaning'}
              <Icon icon={faBroom} class="text-warning" />
            {:else}
              <Icon icon={faCalendarDays} class="text-warning" />
            {/if}
          {/if}
          {#if profile.debugUserPhone}
            <span class="text-body-sm text-on-surface-variant">[{profile.debugUserPhone} {profile._id}]</span>
          {/if}
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
          <div class="text-right text-label-sm text-on-surface-variant">
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
