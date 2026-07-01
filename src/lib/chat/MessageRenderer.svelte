<script lang="ts">
  import type { Message } from './types';
  import { resolveComponents, getSlotContext } from './registry.svelte';

  let { message, meUserId, authorName = '', timeLabel = '', isGroupStart = false, isGroupEnd = false }:
    { message: Message; meUserId?: string; authorName?: string; timeLabel?: string; isGroupStart?: boolean; isGroupEnd?: boolean } = $props();

  const slots = $derived(resolveComponents(message.type));
  const me = $derived(!!meUserId && message.userId === meUserId);
  // Uniform prop set for every slot: host slot-context spread first, then the kit props. `me` and the
  // group-run flags are per-message so they can't live in the static slot context — the renderer
  // computes/forwards them here. Extra props a given slot doesn't read are harmless (Svelte ignores them).
  const slotProps = $derived({ ...getSlotContext(), message, meUserId, me, authorName, timeLabel, isGroupStart, isGroupEnd });
</script>

<div class="flex flex-col gap-0.5">
  {#if slots.header}{@const Header = slots.header}<Header {...slotProps} />{/if}
  {#if slots.media}{@const Media = slots.media}<Media {...slotProps} />{/if}
  {#if slots.body}{@const Body = slots.body}<Body {...slotProps} />{/if}
  {#if slots.footer}{@const Footer = slots.footer}<Footer {...slotProps} />{/if}
  {#if slots.time}{@const Time = slots.time}<Time {...slotProps} />{/if}
</div>
