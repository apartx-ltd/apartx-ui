<script>
  // Audio media — kit default slot for the `audio` message type. Native <audio controls>; a custom
  // waveform player is deferred polish. Not full-bleed — renders in the normal padded stacked bubble.
  // While the server converts a voice note (ogg/webm → AAC, which iOS plays) the file is
  // 'processing': a stub instead of a player that would fail on iOS. The message is re-pushed with
  // the ready file, and the stub turns into the player.
  import Progress from '../../ui/display/Progress.svelte';
  import { chatT } from '../i18n';
  import { isMediaProcessing } from '../helpers';

  let { message, processingLabel = chatT('chat.audio_processing', { defaultValue: 'Processing audio…' }) } = $props();
  let file = $derived(message.meta?.file ?? {});
  let processing = $derived(isMediaProcessing(file));
</script>

{#if processing}
  <div class="px-3 pt-2" data-testid="chat-audio-processing">
    <div class="flex h-[54px] w-[260px] max-w-full flex-col justify-center gap-2 rounded-full bg-surface-container-high px-5">
      <span class="text-body-sm text-on-surface-variant">{processingLabel}</span>
      <Progress indeterminate />
    </div>
  </div>
{:else if file.url}
  <div class="px-3 pt-2">
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio controls src={file.url} class="max-w-full"></audio>
  </div>
{/if}
