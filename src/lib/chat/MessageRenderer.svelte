<script lang="ts">
  import type { Message } from './types';
  import { resolveComponents, getSlotContext } from './registry.svelte';

  let { message, meUserId, authorName = '', timeLabel = '', isGroupStart = false, isGroupEnd = false, fullBleed = false }:
    { message: Message; meUserId?: string; authorName?: string; timeLabel?: string; isGroupStart?: boolean; isGroupEnd?: boolean; fullBleed?: boolean } = $props();

  const slots = $derived(resolveComponents(message.type));
  const me = $derived(!!meUserId && message.userId === meUserId);
  const hasCaption = $derived(!!message.text && message.text.trim().length > 0);
  // Full-bleed media with no caption/footer → the time floats over the media corner; otherwise it
  // rides the end of the (caption or plain) text via `floatBody`, telegram-style. Business cards and
  // audio/document keep the stacked layout (time on its own row below the card).
  const overlayTime = $derived(fullBleed && !hasCaption && !slots.footer);
  const isText = $derived(message.type === 'text');
  // The header slot (reply quote / author name) is always present but renders nothing unless there's a
  // reply or an incoming group-start author. Gate its padded wrapper so a caption-less full-bleed media
  // message has no empty top strip of bubble background above the image.
  const hasHeaderContent = $derived((isGroupStart && !me) || !!message.meta?.replyMessage);
  // Uniform prop set for every slot: host slot-context spread first, then the kit props. `me` and the
  // group-run flags are per-message so they can't live in the static slot context — the renderer
  // computes/forwards them here. Extra props a given slot doesn't read are harmless (Svelte ignores them).
  const slotProps = $derived({ ...getSlotContext(), message, meUserId, me, authorName, timeLabel, isGroupStart, isGroupEnd, fullBleed });
</script>

<!-- Telegram-style running text with the time floated onto the last line, bottom-aligned. `flow-root`
     establishes a BFC so the float is contained (no clearfix needed); short text keeps the time on the
     same line, long text wraps and the time settles at the bottom-right. -->
{#snippet floatBody()}
  <div class="flow-root whitespace-pre-wrap break-words text-body-md">
    {#if slots.body}{@const Body = slots.body}<Body {...slotProps} />{/if}
    {#if slots.time}
      {@const Time = slots.time}
      <span class="float-right ml-1 flex h-6 items-end text-[10px]"><Time {...slotProps} /></span>
    {/if}
  </div>
{/snippet}

{#if fullBleed && slots.media}
  {@const Media = slots.media}
  <!-- Full-bleed media bubble: header (reply/author) padded above, media edge-to-edge, then either the
       time overlaid on the media (no caption) or a padded caption block with the time floated in. -->
  {#if slots.header && hasHeaderContent}
    {@const Header = slots.header}
    <div class="px-2 pt-1.5 pb-1"><Header {...slotProps} /></div>
  {/if}
  <div class="relative">
    <Media {...slotProps} />
    {#if overlayTime && slots.time}
      {@const Time = slots.time}
      <div class="absolute bottom-1 right-1.5 flex items-center rounded-full bg-black/45 px-1.5 py-0.5">
        <Time {...slotProps} overlay />
      </div>
    {/if}
  </div>
  {#if !overlayTime}
    <div class="px-2 py-1.5">
      {#if slots.footer}
        {@const Footer = slots.footer}
        <div class="flex flex-col gap-0.5">
          {#if slots.body}{@const Body = slots.body}<Body {...slotProps} />{/if}
          <Footer {...slotProps} />
          {#if slots.time}{@const Time = slots.time}<Time {...slotProps} />{/if}
        </div>
      {:else}
        {@render floatBody()}
      {/if}
    </div>
  {/if}
{:else if isText && !slots.footer}
  <!-- Plain text message: header (reply quote) above, then running text with the floated time. The
       bubble supplies the padding. -->
  {#if slots.header}{@const Header = slots.header}<Header {...slotProps} />{/if}
  {@render floatBody()}
{:else}
  <!-- Stacked layout: business cards, audio/document, text-with-footer. -->
  <div class="flex flex-col gap-0.5">
    {#if slots.header}{@const Header = slots.header}<Header {...slotProps} />{/if}
    {#if slots.media}{@const Media = slots.media}<Media {...slotProps} />{/if}
    {#if slots.body}{@const Body = slots.body}<Body {...slotProps} />{/if}
    {#if slots.footer}{@const Footer = slots.footer}<Footer {...slotProps} />{/if}
    {#if slots.time}{@const Time = slots.time}<Time {...slotProps} />{/if}
  </div>
{/if}
