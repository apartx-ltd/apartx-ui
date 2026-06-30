<script lang="ts">
  import { Lightbox } from '$lib/lightbox';

  // Public placeholder images (picsum) — deterministic via fixed ids.
  const images = [
    { src: 'https://picsum.photos/id/1015/1200/800', alt: 'River' },
    { src: 'https://picsum.photos/id/1025/1200/800', alt: 'Dog' },
    { src: 'https://picsum.photos/id/1003/800/1200', alt: 'Deer' },
    { src: 'https://picsum.photos/id/1039/1600/900', alt: 'Waterfall' },
  ];

  let open = $state(false);
  let index = $state(0);

  function openAt(i: number) {
    index = i;
    open = true;
  }
</script>

<div class="mx-auto max-w-3xl">
  <h1 class="text-headline-md text-on-surface mb-2">Lightbox</h1>
  <p class="text-body-md text-on-surface-variant mb-6">
    Click a thumbnail to open the viewer (zoom / pan / rotate / arrow-key nav from
    viewerjs). Close with Esc, the backdrop, or the toolbar button — <code>open</code>
    flips back to <code>false</code>.
  </p>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each images as image, i (i)}
      <button
        type="button"
        onclick={() => openAt(i)}
        class="aspect-square overflow-hidden rounded-md bg-surface-container outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img src={image.src} alt={image.alt} class="h-full w-full object-cover" />
      </button>
    {/each}
  </div>

  <p class="text-label-md text-on-surface-variant mt-4">
    State — open: {open}, index: {index}
  </p>

  <Lightbox {images} bind:open bind:index onClose={() => console.log('lightbox closed')} />
</div>
