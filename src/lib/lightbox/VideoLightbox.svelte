<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from '../ui/overlays/Dialog.svelte';

  /**
   * Full-screen video player. Built on the kit `fullScreen` Dialog, so it registers with the
   * overlay-stack: native/browser BACK closes it (plus ESC / backdrop / X), no extra history
   * plumbing. Controls come from `media-chrome` (custom elements, lazy-registered on mount →
   * SSR-safe, mirrors how Lightbox lazy-loads viewerjs). Theme via media-chrome CSS vars → M3.
   *
   * @example
   *   let open = $state(false);
   *   <button onclick={() => (open = true)}>play</button>
   *   <VideoLightbox src={url} poster={posterUrl} bind:open />
   */
  let {
    src,
    poster = '',
    open = $bindable(false),
    onClose,
  }: {
    src: string;
    poster?: string;
    open?: boolean;
    onClose?: () => void;
  } = $props();

  // Custom elements are browser-only + heavy → registered lazily on mount. Until this resolves
  // the <media-controller> tags are inert custom elements (still render the <video> inside).
  let ready = $state(false);
  onMount(async () => {
    await import('media-chrome');
    ready = true;
  });

  function handleOpenChange(v: boolean) {
    if (!v) onClose?.();
  }
</script>

<Dialog
  bind:open
  fullScreen
  title="Video"
  onOpenChange={handleOpenChange}
  contentClass="bg-black"
  bodyClass="flex-1 min-h-0 grid place-items-center p-0 bg-black"
>
  {#if ready}
    <media-controller class="h-full w-full">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" {src} {poster} playsinline autoplay class="h-full w-full object-contain"></video>
      <media-control-bar>
        <media-play-button></media-play-button>
        <media-time-range></media-time-range>
        <media-time-display showduration></media-time-display>
        <media-mute-button></media-mute-button>
        <media-fullscreen-button></media-fullscreen-button>
      </media-control-bar>
    </media-controller>
  {/if}
</Dialog>

<style>
  media-controller {
    --media-primary-color: var(--color-on-surface, #fff);
    --media-secondary-color: transparent;
    --media-control-background: transparent;
    --media-control-hover-background: rgb(255 255 255 / 0.12);
    --media-range-track-background: rgb(255 255 255 / 0.3);
    --media-range-thumb-background: var(--color-primary, #fff);
    --media-font-size: 13px;
    background: #000;
    aspect-ratio: unset;
  }
</style>
