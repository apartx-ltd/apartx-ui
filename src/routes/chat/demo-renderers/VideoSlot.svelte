<script lang="ts">
  import type { Message } from '$lib/chat';

  // A video message carries its source in meta { src, poster?, mime?, width?, height? }. Lightbox
  // (viewerjs) is image-only, so video gets a native inline <video> player; the caption stays in
  // the default body slot (message.text).
  //
  // Sizing mirrors MediaSlot: the wrapper fills the bubble but floors it at 300px, and the player
  // is `w-0 min-w-full` so its intrinsic width (300×150 until metadata lands, then 1280×720) never
  // feeds the shrink-to-fit bubble. Height comes from the aspect-ratio in meta, so the box is
  // reserved before a single byte of the clip arrives.
  let { message }: { message: Message } = $props();
  const meta = $derived(message.meta ?? {});
  const ratio = $derived(meta.width && meta.height ? `${meta.width}/${meta.height}` : '16/9');
</script>

{#if meta.src}
  <div class="w-full min-w-[300px]">
    <video
      controls
      preload="metadata"
      poster={meta.poster ?? ''}
      style="aspect-ratio:{ratio}"
      class="w-0 min-w-full rounded-lg bg-surface-variant object-cover"
    >
      <source src={meta.src} type={meta.mime ?? 'video/mp4'} />
      <track kind="captions" />
    </video>
  </div>
{/if}
