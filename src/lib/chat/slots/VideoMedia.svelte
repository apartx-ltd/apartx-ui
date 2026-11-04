<script>
  // Video media — kit default slot for the `video` message type. Telegram-style: a poster tile
  // (no video bytes loaded) with a centered play button + duration badge; tapping opens the kit
  // VideoLightbox (fullscreen media-chrome player, closes on native back). The box is reserved
  // from known dimensions so the row doesn't reflow when the poster loads.
  import Icon from '../../ui/display/Icon.svelte';
  import { faPlay } from '@fortawesome/free-solid-svg-icons';
  // Direct file import (NOT the '../../lightbox' barrel) — the barrel also re-exports the
  // viewerjs-backed Lightbox, whose static `viewerjs/dist/viewer.css` import would otherwise be
  // dragged into every chat bundle. VideoLightbox itself lazy-loads media-chrome, so it's cheap.
  import VideoLightbox from '../../lightbox/VideoLightbox.svelte';
  import Progress from '../../ui/display/Progress.svelte';
  import { chatT } from '../i18n';
  import { formatDuration, createMediaTapGuard, mediaBox, isMediaProcessing, MEDIA_BOX_MAX } from '../helpers';

  let { message, processingLabel = chatT('chat.video_processing', { defaultValue: 'Processing video…' }) } = $props();

  let file = $derived(message.meta?.file ?? {});
  let url = $derived(file.url ?? (message.sendState === 'sending' ? message.meta?.previewUrl : undefined));
  let poster = $derived(file.posterUrl ?? '');
  let duration = $derived(formatDuration(file.duration ?? message.meta?.duration));

  let sending = $derived(message.sendState === 'sending' || message.meta?.status === 'sending');
  let failed = $derived(message.sendState === 'failed' || message.meta?.status === 'error');
  // apartx-video is transcoding it: a badge only — the original stays playable meanwhile.
  let processing = $derived(!sending && !failed && isMediaProcessing(file));

  // Та же общая формула, что у картинки: `mediaBoxHeight` (оценка высоты строки) одна на оба типа
  // (через `isFullBleedMedia`), так что видео обязано считать коробку ровно так же.
  let box = $derived(mediaBox(file.width ?? message.meta?.width, file.height ?? message.meta?.height));

  let open = $state(false);
  const canPlay = $derived(!!url && !sending);

  // Tap opens the player; long-press / right-click opens the message menu — never both.
  const tapGuard = createMediaTapGuard(() => { open = true; });
</script>

<!-- Unknown dimensions still get a FIXED box (16:9, poster covers) — an intrinsic-height fallback
     would reflow the row when the poster lands, and stable row heights are what keeps the
     virtualized list's scroll position deterministic. -->
<div
  class="relative overflow-hidden bg-surface-container-high"
  style={box ? `width:${box.w}px;height:${box.h}px` : `width:${MEDIA_BOX_MAX}px;max-width:100%;aspect-ratio:16/9`}
>
  {#if poster}
    <img src={poster} alt="" class="h-full w-full object-cover" />
  {/if}

  {#if canPlay}
    <button
      type="button"
      onpointerdown={tapGuard.onpointerdown}
      oncontextmenu={tapGuard.oncontextmenu}
      onclick={tapGuard.onclick}
      class="absolute inset-0 grid place-items-center"
      aria-label="Play video"
    >
      <span class="grid h-12 w-12 place-items-center rounded-full bg-scrim/50 text-white">
        <Icon icon={faPlay} />
      </span>
    </button>
    {#if duration}
      <span class="absolute bottom-1 right-1 rounded bg-scrim/60 px-1.5 py-0.5 text-xs text-white">
        {duration}
      </span>
    {/if}
    <VideoLightbox src={url} {poster} bind:open />
  {/if}

  {#if sending}
    <div class="absolute inset-0 grid place-items-center bg-scrim/30 text-body-sm text-white">Uploading…</div>
  {:else if failed}
    <div class="absolute inset-0 grid place-items-center text-body-sm text-error">Upload failed</div>
  {:else if processing}
    <div
      class="pointer-events-none absolute bottom-1 left-1 flex w-32 flex-col gap-1 rounded bg-scrim/60 px-1.5 py-1 text-xs text-white"
      data-testid="chat-video-processing"
    >
      {processingLabel}
      <Progress indeterminate class="bg-white/30" />
    </div>
  {/if}
</div>
