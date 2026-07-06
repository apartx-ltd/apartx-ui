<script lang="ts">
  import Fa from 'svelte-fa';
  import { faCheck, faCheckDouble, faTriangleExclamation, faComment } from '@fortawesome/free-solid-svg-icons';
  import { faWhatsapp, faTelegram } from '@fortawesome/free-brands-svg-icons';
  import Icon from '../../ui/display/Icon.svelte';
  import type { Message } from '../types';
  import { deliveryTick } from '../helpers';

  let { message, meUserId, timeLabel = '' }: { message: Message; meUserId?: string; timeLabel?: string } = $props();

  const isMine = $derived(!!meUserId && message.userId === meUserId);
  const tick = $derived(isMine ? deliveryTick(message, meUserId) : null);

  const CHANNEL_ICON: Record<string, any> = { whatsapp: faWhatsapp, telegram: faTelegram };
  const channelIcon = (c: string) => CHANNEL_ICON[c] ?? faComment;
  const channelClass = (s: string) =>
    s === 'failed' ? 'text-error' : (s === 'delivered' || s === 'read') ? 'text-success' : 'text-on-surface-variant';
  const channelTitle = (c: { channel: string; state: string; error?: string }) =>
    c.error ? `${c.channel}: ${c.state} — ${c.error}` : `${c.channel}: ${c.state}`;
</script>

<span class="inline-flex items-center gap-1 text-[10px] text-on-surface-variant">
  <span>{timeLabel}</span>
  {#if tick === 'failed'}
    <Fa icon={faTriangleExclamation} class="text-error" />
  {:else if tick === 'read'}
    <Fa icon={faCheckDouble} class="text-primary" />
  {:else if tick === 'delivered'}
    <Fa icon={faCheckDouble} />
  {:else if tick === 'sent'}
    <Fa icon={faCheck} />
  {/if}
  {#if isMine && message.channels?.length}
    {#each message.channels as ch (ch.channel)}
      <span title={channelTitle(ch)} class={channelClass(ch.state)}>
        <Icon icon={channelIcon(ch.channel)} size="xs" />
      </span>
    {/each}
  {/if}
</span>
