<script lang="ts">
  import type { Message } from './types';
  import { resolveComponents, getSlotContext } from './registry.svelte';

  let { message, meUserId, authorName = '', timeLabel = '' }:
    { message: Message; meUserId?: string; authorName?: string; timeLabel?: string } = $props();

  const slots = $derived(resolveComponents(message.type));
</script>

<div class="flex flex-col gap-0.5">
  {#if slots.header}{@const Header = slots.header}<Header {...getSlotContext()} {message} {authorName} />{/if}
  {#if slots.media}{@const Media = slots.media}<Media {...getSlotContext()} {message} />{/if}
  {#if slots.body}{@const Body = slots.body}<Body {...getSlotContext()} {message} />{/if}
  {#if slots.footer}{@const Footer = slots.footer}<Footer {...getSlotContext()} {message} />{/if}
  {#if slots.time}{@const Time = slots.time}<Time {...getSlotContext()} {message} {meUserId} {timeLabel} />{/if}
</div>
