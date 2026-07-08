<script lang="ts">
  import Fa from 'svelte-fa';
  import { faCheck, faCheckDouble, faTriangleExclamation, faComment, faClock } from '@fortawesome/free-solid-svg-icons';
  import { faWhatsapp, faTelegram } from '@fortawesome/free-brands-svg-icons';
  import Icon from '../../ui/display/Icon.svelte';
  import MessengerIcon from './MessengerIcon.svelte';
  import type { Message } from '../types';
  import { deliveryTick } from '../helpers';

  let { message, meUserId, counterpartReadSeq, counterpartDeliveredSeq, timeLabel = '' }: { message: Message; meUserId?: string; counterpartReadSeq?: number; counterpartDeliveredSeq?: number; timeLabel?: string } = $props();

  const isMine = $derived(!!meUserId && message.userId === meUserId);
  const tick = $derived(isMine ? deliveryTick(message, meUserId, counterpartReadSeq, counterpartDeliveredSeq) : null);

  const CHANNEL_ICON: Record<string, any> = { whatsapp: faWhatsapp, telegram: faTelegram };
  const channelIcon = (c: string) => CHANNEL_ICON[c] ?? faComment;
  const channelClass = (s: string) =>
    s === 'failed' ? 'text-error' : s === 'read' ? 'text-success' : 'text-on-surface-variant';
  const channelTitle = (c: { channel: string; state: string; error?: string }) =>
    c.error ? `${c.channel}: ${c.state} — ${c.error}` : `${c.channel}: ${c.state}`;
</script>

<span class="flex justify-end items-center gap-1 text-[10px] text-on-surface-variant">
  <span>{timeLabel}</span>
  {#if tick === 'failed'}
    <Fa icon={faTriangleExclamation} class="text-error" />
  {:else if tick === 'read'}
    <Fa icon={faCheckDouble} class="text-primary" />
  {:else if tick === 'delivered'}
    <Fa icon={faCheckDouble} />
  {:else if tick === 'sent'}
    <Fa icon={faCheck} />
  {:else if tick === 'pending'}
    <Fa icon={faClock} />
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
