<script lang="ts">
  import type { Message } from '$lib/chat';

  // A video message carries its source in meta { src, poster?, mime?, width?, height? }. Lightbox
  // (viewerjs) is image-only, so video gets a native inline <video> player; the caption stays in
  // the default body slot (message.text).
  //
  // The box is reserved from meta.width/height: an unsized <video> falls back to a 300×150
  // intrinsic size and snaps to the real aspect once metadata loads, jolting the whole list.
  let { message }: { message: Message } = $props();
  const meta = $derived(message.meta ?? {});
  const ratio = $derived(meta.width && meta.height ? `${meta.width}/${meta.height}` : '16/9');
</script>

{#if meta.src}
  <video
    controls
    preload="metadata"
    poster={meta.poster ?? ''}
    style="aspect-ratio:{ratio}"
    class="w-[300px] max-w-full rounded-lg bg-surface-variant object-cover"
  >
    <source src={meta.src} type={meta.mime ?? 'video/mp4'} />
    <track kind="captions" />
  </video>
{/if}
