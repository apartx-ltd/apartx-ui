<script lang="ts">
  import type { Message } from '$lib/chat';

  // An AI assistant message: a distinct badge above the text. The 'pending' meta flag
  // (set while the answer is still "typing") shows an animated ellipsis.
  let { message }: { message: Message } = $props();
  const pending = $derived(!!message.meta?.pending);
</script>

<div class="flex flex-col gap-1">
  <span class="inline-flex w-fit items-center gap-1 rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm text-on-tertiary-container">
    🤖 AI Assistant
  </span>
  {#if pending}
    <span class="text-body-md text-on-surface-variant italic">typing…</span>
  {:else}
    <span class="whitespace-pre-wrap text-body-md">{message.text}</span>
  {/if}
</div>
