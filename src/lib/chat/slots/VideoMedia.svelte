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
  import { formatDuration, createMediaTapGuard } from '../helpers';

  let { message } = $props();

  const MAX = 300;

  let file = $derived(message.meta?.file ?? {});
  let url = $derived(file.url ?? (message.sendState === 'sending' ? message.meta?.previewUrl : undefined));
  let poster = $derived(file.posterUrl ?? '');
  let duration = $derived(formatDuration(file.duration ?? message.meta?.duration));

  let sending = $derived(message.sendState === 'sending' || message.meta?.status === 'sending');
  let failed = $derived(message.sendState === 'failed' || message.meta?.status === 'error');

  let box = $derived.by(() => {
    const w = file.width ?? message.meta?.width;
    const h = file.height ?? message.meta?.height;
    if (!w || !h) return null;
    const scale = Math.min(1, MAX / w, MAX / h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  });

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
  style={box ? `width:${box.w}px;height:${box.h}px` : `width:${MAX}px;max-width:100%;aspect-ratio:16/9`}
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
  {/if}
</div>
