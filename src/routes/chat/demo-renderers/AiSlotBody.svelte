<script lang="ts">
  import type { Message } from '$lib/chat';

  // An AI assistant message: a distinct badge above the text. While the answer streams,
  // meta.pending shows "typing…" before the first token and meta.streaming renders a
  // blinking cursor after the partial text.
  let { message }: { message: Message } = $props();
  const pending = $derived(!!message.meta?.pending);
  const streaming = $derived(!!message.meta?.streaming);
</script>

<div class="flex flex-col gap-1">
  <span class="inline-flex w-fit items-center gap-1 rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm text-on-tertiary-container">
    🤖 AI Assistant
  </span>
  {#if pending}
    <span class="text-body-md text-on-surface-variant italic">typing…</span>
  {:else}
    <span class="whitespace-pre-wrap text-body-md">{message.text}{#if streaming}<span class="ml-0.5 inline-block animate-pulse">▌</span>{/if}</span>
  {/if}
</div>
