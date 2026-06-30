<script lang="ts">
  import type { ChatSession } from './session.svelte';

  let { session, placeholder = 'Message', sendLabel = 'Send' }:
    { session: ChatSession; placeholder?: string; sendLabel?: string } = $props();

  const composer = session.composer;

  async function submit() {
    if (!composer.draft.trim()) return;
    await session.send();
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }
</script>

<div class="flex flex-col gap-1 border-t border-outline-variant p-2">
  {#if composer.replyTo}
    <div class="flex items-center gap-2 rounded bg-surface-container px-2 py-1 text-xs">
      <div class="flex-1 truncate">
        <span class="font-medium">{composer.replyTo.authorName}</span>
        <span class="text-on-surface-variant"> {composer.replyTo.textPreview}</span>
      </div>
      <button type="button" class="text-on-surface-variant" onclick={() => composer.clearReply()} aria-label="Cancel reply">✕</button>
    </div>
  {/if}
  <div class="flex items-end gap-2">
    <textarea
      class="flex-1 resize-none rounded-2xl bg-surface-container px-3 py-2 outline-none"
      rows="1"
      {placeholder}
      value={composer.draft}
      oninput={(e) => composer.setDraft((e.target as HTMLTextAreaElement).value)}
      onkeydown={onKeydown}
    ></textarea>
    <button type="button" class="rounded-full bg-primary px-4 py-2 text-on-primary" onclick={submit}>{sendLabel}</button>
  </div>
</div>
