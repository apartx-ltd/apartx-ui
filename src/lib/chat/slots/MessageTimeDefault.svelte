<script lang="ts">
  import Fa from 'svelte-fa';
  import { faCheck, faCheckDouble, faTriangleExclamation, faComment, faClock } from '@fortawesome/free-solid-svg-icons';
  import { faWhatsapp, faTelegram } from '@fortawesome/free-brands-svg-icons';
  import Icon from '../../ui/display/Icon.svelte';
  import MessengerIcon from './MessengerIcon.svelte';
  import type { Message } from '../types';
  import { deliveryTick } from '../helpers';

  // `overlay` = rendered over media (telegram-style media-only bubble): force legible white text on
  // the translucent scrim the renderer provides, instead of the on-surface palette used below a bubble.
  let { message, meUserId, counterpartReadSeq, counterpartDeliveredSeq, timeLabel = '', overlay = false }: { message: Message; meUserId?: string; counterpartReadSeq?: number; counterpartDeliveredSeq?: number; timeLabel?: string; overlay?: boolean } = $props();

  const isMine = $derived(!!meUserId && message.userId === meUserId);
  const tick = $derived(isMine ? deliveryTick(message, meUserId, counterpartReadSeq, counterpartDeliveredSeq) : null);

  const CHANNEL_ICON: Record<string, any> = { whatsapp: faWhatsapp, telegram: faTelegram };
  const channelIcon = (c: string) => CHANNEL_ICON[c] ?? faComment;
  const channelClass = (s: string) =>
    s === 'failed' ? 'text-error' : s === 'read' ? 'text-success' : 'text-on-surface-variant';
  const channelTitle = (c: { channel: string; state: string; error?: string }) =>
    c.error ? `${c.channel}: ${c.state} — ${c.error}` : `${c.channel}: ${c.state}`;
</script>

<span class="flex justify-end items-center gap-1 text-[10px] {overlay ? 'text-white' : 'text-on-surface-variant'}">
  <span>{timeLabel}</span>
  {#if tick}
    <!-- Fixed-width tick slot. FA sizes a glyph by its viewBox aspect, so the four states are all
         different widths (check 0.875em, clock 1em, triangle 1em, check-double 1.25em). This whole
         time block is `float-right` inside the running text, so a changing tick changed the float's
         width and could re-wrap the last line — the bubble twitched as the message advanced
         pending → sent → delivered → read. Reserve the widest (1.25em) once and centre the glyph in
         it: the float's width is then identical in every state. -->
    <span data-tick={tick} class="flex w-[1.25em] shrink-0 justify-center">
      {#if tick === 'failed'}
        <Fa icon={faTriangleExclamation} class="text-error" />
      {:else if tick === 'read'}
        <Fa icon={faCheckDouble} class={overlay ? 'text-white' : 'text-primary'} />
      {:else if tick === 'delivered'}
        <Fa icon={faCheckDouble} />
      {:else if tick === 'sent'}
        <Fa icon={faCheck} />
      {:else if tick === 'pending'}
        <Fa icon={faClock} />
      {/if}
    </span>
  {/if}
  {#if isMine && message.channels?.length}
    {#each message.channels as ch (ch.channel)}
      <span title={channelTitle(ch)} class={channelClass(ch.state)}>
        <Icon icon={channelIcon(ch.channel)} size="xs" />
      </span>
    {/each}
  {/if}
  {#if !isMine}
    <MessengerIcon {message} class="text-[10px]" />
  {/if}
</span>
