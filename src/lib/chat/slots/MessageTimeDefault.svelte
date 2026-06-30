<script lang="ts">
  import Fa from 'svelte-fa';
  import { faCheck, faCheckDouble, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
  import type { Message } from '../types';
  import { deliveryTick } from '../helpers';

  let { message, meUserId, timeLabel = '' }: { message: Message; meUserId?: string; timeLabel?: string } = $props();

  const isMine = $derived(!!meUserId && message.userId === meUserId);
  const tick = $derived(isMine ? deliveryTick(message, meUserId) : null);
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
</span>
