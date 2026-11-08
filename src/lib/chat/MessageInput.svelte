<script lang="ts">
  import type { Snippet } from 'svelte';
  import { faPaperPlane, faMicrophone, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
  import Icon from '../ui/display/Icon.svelte';
  import type { ChatSession } from './session.svelte';
  import type { VoiceRecorder } from './types';
  import { formatDuration } from './helpers';
  import { createVoiceGesture } from './voice-gesture.svelte';

  /** A host-opaque pending attachment for the default preview strip. */
  interface PendingAttachment { id: string; name: string; previewUrl?: string }

  let {
    session, placeholder = 'Message', sendLabel = 'Send',
    replyToLabel = 'Reply to', cancelReplyLabel = 'Cancel reply', attachLabel = 'Attach',
    onTyping, onPickFiles, pendingAttachments = [], onRemoveAttachment,
    leading, gate,
    voice = null,
    voiceLabel = 'Record voice message', voiceCancelLabel = 'Cancel',
    voiceHoldHint = 'Hold to record, release to send', voiceSlideHint = 'Slide to cancel',
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
      /**
       * Telegram-style voice notes: with a recorder and an empty draft the send button is a
       * microphone — hold to record, release to send, slide left to cancel, slide up to keep
       * recording hands-free. Typing swaps it back to the send button. The host records, uploads
       * and sends (see `VoiceRecorder`); without a recorder the composer is text-only as before.
       */
      voice?: VoiceRecorder | null;
      voiceLabel?: string; voiceCancelLabel?: string; voiceHoldHint?: string; voiceSlideHint?: string;
    } = $props();

  // Track the composer of the CURRENT session. If the host swaps the `session` prop (e.g. rebuilds it),
  // a plain `const composer = session.composer` would stay pinned to the old session — the textarea would
  // write into the disposed composer while `session.send()` reads the new (empty) one, so sending silently
  // no-ops until remount. `$derived` keeps `composer` and `session.send()` on the same instance.
  const composer = $derived(session.composer);
  // Bridge the composer's getter-state into reactive reads. Reading `composer.draft`/`composer.replyTo`
  // directly in the template would compile to a one-time attribute — a programmatic setDraft/setReply
  // (e.g. a quick reply) updates the signal but never re-renders. `$derived` tracks the underlying $state.
  const draftValue = $derived(composer.draft);
  const replyTo = $derived(composer.replyTo);
  let ta = $state<HTMLTextAreaElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  // The microphone takes the send button's place only while there is nothing to send as text.
  const gesture = createVoiceGesture(() => voice);
  const micInsteadOfSend = $derived(!!voice && !draftValue.trim());
  const recordingRow = $derived(gesture.phase !== 'idle');
  // The host's recorder ended on its own (auto-stop, chat left, denied microphone): back to idle.
  $effect(() => { if (voice?.recording === false) gesture.sync(false); });
  $effect(() => () => gesture.dispose());

  function autosize() {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }
  // Re-fit height whenever the draft changes — covers programmatic setDraft (quick reply,
  // draft restore) where there's no input event to trigger autosize().
  $effect(() => { draftValue; autosize(); });
  // Focus the composer when a reply is attached (e.g. from the context-menu "Reply") so the user
  // can type immediately. Guarded on `replyTo` so clearing the reply doesn't grab focus.
  $effect(() => { if (replyTo) ta?.focus(); });
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
    {#if replyTo}
      <div class="flex items-center gap-2 rounded bg-surface-container px-2 py-1 text-xs">
        <div class="flex-1 truncate">
          <span class="font-medium">{replyToLabel} {replyTo.authorName}</span>
          <span class="text-on-surface-variant"> {replyTo.textPreview}</span>
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
      {#if recordingRow && voice}
        <!-- Recording: the timer takes the field's place; while holding, the hint slides with the finger;
             once locked, a Cancel button. -->
        <div class="flex min-h-10 flex-1 items-center gap-2 rounded-2xl bg-surface-container px-3 py-2" data-testid="chat-composer-recording">
          <span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-error" aria-hidden="true"></span>
          <span class="tabular-nums" role="timer" data-testid="chat-composer-voice-seconds">{formatDuration(voice.seconds) || '0:00'}</span>
          {#if gesture.phase === 'locked'}
            <button
              type="button"
              class="ml-auto px-2 text-primary"
              data-testid="chat-composer-voice-cancel"
              onclick={() => gesture.cancel()}
            >{voiceCancelLabel}</button>
          {:else}
            <span
              class="ml-auto flex items-center gap-1 truncate text-sm text-on-surface-variant"
              style="transform: translateX({gesture.dx}px); opacity: {1 + gesture.dx / 80}"
              data-testid="chat-composer-voice-hint"
            ><Icon icon={faChevronLeft} /> {voiceSlideHint}</span>
          {/if}
        </div>
      {:else}
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
          value={draftValue}
          oninput={(e) => { composer.setDraft((e.target as HTMLTextAreaElement).value); autosize(); }}
          onkeydown={onKeydown}
        ></textarea>
      {/if}

      {#if (micInsteadOfSend || recordingRow) && voice}
        {#if gesture.phase === 'locked' || gesture.sending}
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50"
            onclick={() => gesture.send()}
            disabled={gesture.sending}
            aria-label={sendLabel}
            title={sendLabel}
            data-testid="chat-composer-send"
          >
            <Icon icon={faPaperPlane} />
          </button>
        {:else}
          <!-- touch-action/select/callout off: a held finger must not scroll, select text or open the
               long-press menu; the gesture owns the pointer. -->
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-full bg-primary text-on-primary transition-transform {gesture.phase === 'holding' ? 'scale-125' : ''}"
            style="-webkit-touch-callout: none"
            onpointerdown={gesture.onpointerdown}
            onpointermove={gesture.onpointermove}
            onpointerup={gesture.onpointerup}
            onpointercancel={gesture.onpointercancel}
            onkeydown={gesture.onkeydown}
            onclick={gesture.onclick}
            oncontextmenu={(e) => e.preventDefault()}
            aria-label={voiceLabel}
            title={voiceLabel}
            aria-pressed={gesture.phase === 'holding'}
            data-testid="chat-composer-voice"
          >
            <Icon icon={faMicrophone} />
          </button>
        {/if}
      {:else}
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
          onclick={submit}
          aria-label={sendLabel}
          title={sendLabel}
          data-testid="chat-composer-send"
        >
          <Icon icon={faPaperPlane} />
        </button>
      {/if}
    </div>

    {#if gesture.hint}
      <div class="text-right text-xs text-on-surface-variant" role="status" data-testid="chat-composer-voice-hold-hint">{voiceHoldHint}</div>
    {/if}
  </div>
{/if}
