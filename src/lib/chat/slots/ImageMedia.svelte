<script>
  // Full-bleed image/video media — the kit default slot for the `image`/`video` message types.
  // Renders edge-to-edge inside the telegram-style media bubble: Message.svelte drops the bubble
  // padding for full-bleed types and the bubble's overflow-hidden clips the corners, so this fills
  // the whole bubble. `openLightbox` is injected via the kit slot context (host) — clicking a loaded
  // image opens the shared lightbox; absent → opens in a new tab.
  import { createMediaTapGuard } from '../helpers';

  let { message, openLightbox } = $props();

  const MAX = 300;

  // Tap opens the lightbox; long-press / right-click opens the message menu — never both.
  const tapGuard = createMediaTapGuard(() => openLightbox(url));

  let isVideo = $derived((message.type || '').indexOf('video') > -1);
  // "Sending" covers BOTH paths: kit-optimistic sends (session.sendMedia → sendState) and any legacy
  // instant path (meta.status:'sending' with a local blob in meta.previewUrl / meta.file.url).
  let sending = $derived(message.sendState === 'sending' || message.meta?.status === 'sending');
  let failed = $derived(message.sendState === 'failed' || message.meta?.status === 'error');
  // Prefer the uploaded URL; while an optimistic send is in flight, show its local preview.
  let url = $derived(message.meta?.file?.url ?? (message.sendState === 'sending' ? message.meta?.previewUrl : undefined));
  // Upload % only exists on kit-optimistic sends.
  let pct = $derived(message.meta?.uploadProgress != null ? Math.round(message.meta.uploadProgress * 100) : null);

  // Reserve the media box up front from known dimensions (attachment carries width/height from the
  // server; optimistic sends carry meta.width/height) so the row doesn't reflow — and virtua doesn't
  // re-measure — once media loads.
  let box = $derived.by(() => {
    const w = message.meta?.file?.width ?? message.meta?.width;
    const h = message.meta?.file?.height ?? message.meta?.height;
    if (!w || !h) return null;
    const scale = Math.min(1, MAX / w, MAX / h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  });
</script>

<!-- Unknown dimensions still get a FIXED box (4:3, object-fit cover crops the odd aspect) — an
     intrinsic-height fallback would reflow the row when the bytes land, and stable row heights are
     what keeps the virtualized list's scroll position deterministic. -->
<div
  class="relative overflow-hidden bg-surface-container-high"
  style={box ? `width:${box.w}px;height:${box.h}px` : `width:${MAX}px;max-width:100%;aspect-ratio:4/3`}
>
  {#if url && isVideo}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={url} class="w-full h-full object-cover" controls></video>
  {:else if url}
    {@const imgClass = `w-full h-full object-cover ${message.sendState === 'sending' ? 'opacity-60' : ''}`}
    {#if openLightbox && message.sendState !== 'sending'}
      <button type="button" class="block w-full h-full cursor-zoom-in" onpointerdown={tapGuard.onpointerdown} oncontextmenu={tapGuard.oncontextmenu} onclick={tapGuard.onclick} aria-label="View image">
        <img src={url} alt="" class={imgClass} />
      </button>
    {:else}
      <a href={message.meta?.file?.url ?? url} target="_blank" rel="noopener" class="block w-full h-full" onclick={(e) => e.stopPropagation()} oncontextmenu={(e) => e.preventDefault()}>
        <img src={url} alt="" class={imgClass} />
      </a>
    {/if}
  {/if}
  {#if sending}
    <div class="absolute inset-0 flex items-center justify-center bg-scrim/30 text-body-sm text-white">
      Uploading…{#if pct != null} {pct}%{/if}
    </div>
  {:else if failed}
    <div class="absolute inset-0 flex items-center justify-center text-body-sm text-error">Upload failed</div>
  {/if}
</div>
