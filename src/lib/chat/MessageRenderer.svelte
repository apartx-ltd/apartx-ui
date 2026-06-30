<script lang="ts">
  import type { Message } from './types';
  import { resolveComponents } from './registry.svelte';

  let { message, meUserId, authorName = '', timeLabel = '' }:
    { message: Message; meUserId?: string; authorName?: string; timeLabel?: string } = $props();

  const slots = $derived(resolveComponents(message.type));
</script>

<div class="flex flex-col gap-0.5">
  {#if slots.header}{@const Header = slots.header}<Header {message} {authorName} />{/if}
  {#if slots.media}{@const Media = slots.media}<Media {message} />{/if}
  {#if slots.body}{@const Body = slots.body}<Body {message} />{/if}
  {#if slots.footer}{@const Footer = slots.footer}<Footer {message} />{/if}
  {#if slots.time}{@const Time = slots.time}<Time {message} {meUserId} {timeLabel} />{/if}
</div>
