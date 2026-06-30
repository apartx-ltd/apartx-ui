<script lang="ts">
  import { Lightbox } from '$lib/lightbox';
  import type { Message } from '$lib/chat';

  // A media message carries its images in meta.images. This slot renders a thumbnail
  // grid and opens the kit Lightbox (viewerjs zoom/pan) on click — the caption stays
  // in the default body slot (message.text).
  let { message }: { message: Message } = $props();
  const images = $derived(((message.meta?.images ?? []) as { src: string; alt?: string }[]));

  let open = $state(false);
  let index = $state(0);
  function show(i: number) { index = i; open = true; }
</script>

{#if images.length}
  <div class="grid gap-1 {images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}">
    {#each images as img, i (i)}
      <button type="button" class="block overflow-hidden rounded-lg" onclick={() => show(i)}>
        <img src={img.src} alt={img.alt ?? ''} loading="lazy" class="h-32 w-full bg-surface-variant object-cover" />
      </button>
    {/each}
  </div>
  <Lightbox {images} bind:open bind:index />
{/if}
