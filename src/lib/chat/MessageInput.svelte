<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ChatSession } from './session.svelte';

  /** A host-opaque pending attachment for the default preview strip. */
  interface PendingAttachment { id: string; name: string; previewUrl?: string }

  let {
    session, placeholder = 'Message', sendLabel = 'Send',
    replyToLabel = 'Reply to', cancelReplyLabel = 'Cancel reply', attachLabel = 'Attach',
    onTyping, onPickFiles, pendingAttachments = [], onRemoveAttachment,
    leading, gate,
  }:
    {
      session: ChatSession;
      placeholder?: string; sendLabel?: string; replyToLabel?: string;
      cancelReplyLabel?: string; attachLabel?: string;
      onTyping?: () => void;
      onPickFiles?: (files: FileList) => void;
      pendingAttachments?: PendingAttachment[];
      onRemoveAttachment?: (id: string) => void;
      leading?: Snippet;
      gate?: Snippet;
    } = $props();

  const composer = session.composer;
  let ta = $state<HTMLTextAreaElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  function autosize() {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }
  async function submit() {
    if (!composer.draft.trim()) return;
    await session.send();
    autosize();
  }
  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { composer.setDraft(composer.draft + '\n'); autosize(); return; }
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key.length === 1) onTyping?.();
  }
  function onPick(e: Event) {
    const files = (e.currentTarget as HTMLInputElement).files;
    if (files && files.length) onPickFiles?.(files);
    (e.currentTarget as HTMLInputElement).value = '';
  }
</script>

{#if gate}
  {@render gate()}
{:else}
  <div class="flex flex-col gap-1 border-t border-outline-variant p-2">
    {#if composer.replyTo}
      <div class="flex items-center gap-2 rounded bg-surface-container px-2 py-1 text-xs">
        <div class="flex-1 truncate">
          <span class="font-medium">{replyToLabel} {composer.replyTo.authorName}</span>
          <span class="text-on-surface-variant"> {composer.replyTo.textPreview}</span>
        </div>
        <button type="button" class="text-on-surface-variant" onclick={() => composer.clearReply()} aria-label={cancelReplyLabel}>✕</button>
      </div>
    {/if}

    {#if pendingAttachments.length}
      <div class="flex flex-wrap gap-1">
        {#each pendingAttachments as a (a.id)}
          <span class="flex items-center gap-1 rounded bg-surface-container px-2 py-1 text-xs">
            {#if a.previewUrl}<img src={a.previewUrl} alt="" class="h-6 w-6 rounded object-cover" />{/if}
            <span class="truncate max-w-[8rem]">{a.name}</span>
            <button type="button" class="text-on-surface-variant" onclick={() => onRemoveAttachment?.(a.id)} aria-label="Remove">✕</button>
          </span>
        {/each}
      </div>
    {/if}

    <div class="flex items-end gap-2">
      {#if leading}
        {@render leading()}
      {:else if onPickFiles}
        <button type="button" class="px-2 py-2 text-on-surface-variant" onclick={() => fileInput?.click()} aria-label={attachLabel}>📎</button>
        <input bind:this={fileInput} type="file" multiple class="hidden" onchange={onPick} />
      {/if}
      <textarea
        bind:this={ta}
        class="flex-1 resize-none rounded-2xl bg-surface-container px-3 py-2 outline-none"
        rows="1"
        {placeholder}
        value={composer.draft}
        oninput={(e) => { composer.setDraft((e.target as HTMLTextAreaElement).value); autosize(); }}
        onkeydown={onKeydown}
      ></textarea>
      <button type="button" class="rounded-full bg-primary px-4 py-2 text-on-primary" onclick={submit}>{sendLabel}</button>
    </div>
  </div>
{/if}
