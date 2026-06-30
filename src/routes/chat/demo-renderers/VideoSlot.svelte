<script lang="ts">
  import type { Message } from '$lib/chat';

  // A video message carries its source in meta { src, poster?, mime? }. Lightbox (viewerjs)
  // is image-only, so video gets a native inline <video> player; the caption stays in the
  // default body slot (message.text).
  let { message }: { message: Message } = $props();
  const meta = $derived(message.meta ?? {});
</script>

{#if meta.src}
  <video
    controls
    preload="metadata"
    poster={meta.poster ?? ''}
    class="max-h-64 w-full rounded-lg bg-surface-variant object-cover"
  >
    <source src={meta.src} type={meta.mime ?? 'video/mp4'} />
    <track kind="captions" />
  </video>
{/if}
