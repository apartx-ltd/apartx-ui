<script lang="ts">
  import { Lightbox } from '$lib/lightbox';
  import type { Message } from '$lib/chat';

  // A media message carries its images in meta.images. This slot renders a thumbnail
  // grid and opens the kit Lightbox (viewerjs zoom/pan) on click — the caption stays
  // in the default body slot (message.text).
  //
  // The grid takes a definite width and each cell a definite box (aspect-ratio for a lone image,
  // a fixed row height for galleries). Without that the bubble is shrink-to-fit and derives its
  // width from the image's intrinsic size, so the row reflows the moment loading finishes.
  // 300px is the widest media the bubble shows — it, not the caption, sets the bubble width.
  let { message }: { message: Message } = $props();
  const images = $derived(((message.meta?.images ?? []) as { src: string; alt?: string; width?: number; height?: number }[]));
  const single = $derived(images.length === 1);

  let open = $state(false);
  let index = $state(0);
  function show(i: number) { index = i; open = true; }
</script>

{#if images.length}
  <div class="grid w-[300px] max-w-full gap-1 {single ? 'grid-cols-1' : 'grid-cols-2'}">
    {#each images as img, i (i)}
      <button
        type="button"
        class="block overflow-hidden rounded-lg bg-surface-variant {single ? '' : 'h-32'}"
        style={single && img.width && img.height ? `aspect-ratio:${img.width}/${img.height}` : undefined}
        onclick={() => show(i)}
      >
        <img src={img.src} alt={img.alt ?? ''} width={img.width} height={img.height} loading="lazy" class="h-full w-full object-cover" />
      </button>
    {/each}
  </div>
  <Lightbox {images} bind:open bind:index />
{/if}
