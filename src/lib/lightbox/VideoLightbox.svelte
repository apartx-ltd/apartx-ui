<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from '../ui/overlays/Dialog.svelte';
  import Icon from '../ui/display/Icon.svelte';
  import { faXmark } from '@fortawesome/free-solid-svg-icons';
  import { openOverlay, closeOverlay, initOverlayStack } from '../router/overlay/overlay-stack';

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
    // Install the overlay-stack back-interceptor (idempotent — <ModalOutlet> may have already
    // done it in registry hosts; a no-op there, and self-sufficient where there is no registry).
    initOverlayStack();
    await import('media-chrome');
    ready = true;
  });

  // Register with the overlay-stack ourselves. The kit Dialog only does this when rendered inside a
  // <ModalLayer> (registry modals); a standalone Dialog is untouched, so without this a native/browser
  // BACK would navigate the page instead of closing the video. Opening pushes a synthetic history
  // entry; BACK invokes our callback (open=false); a non-back close (X/Esc/programmatic) pops the
  // entry. Idempotent: closeOverlay after a back-driven close is a no-op (token already removed).
  let overlayToken: number | null = null;
  $effect(() => {
    const o = open;
    if (o && overlayToken === null) {
      overlayToken = openOverlay(() => { open = false; });
    } else if (!o && overlayToken !== null) {
      closeOverlay(overlayToken);
      overlayToken = null;
    }
  });
  // Unmounted while still open (defensive): drop the entry WITHOUT an extra history.back.
  $effect(() => () => {
    if (overlayToken !== null) {
      closeOverlay(overlayToken, { viaBack: true });
      overlayToken = null;
    }
  });

  function handleOpenChange(v: boolean) {
    if (!v) onClose?.();
  }
</script>

<Dialog
  bind:open
  fullScreen
  title=""
  showCloseButton={false}
  onOpenChange={handleOpenChange}
  contentClass="bg-black"
  bodyClass="flex-1 min-h-0 grid place-items-center p-0 bg-black"
>
  {#if ready}
    <!-- No Dialog header (fullscreen video). A floating close button keeps a visible affordance
         on desktop; ESC and native/browser back also close (via the overlay-stack). -->
    <button
      type="button"
      onclick={() => (open = false)}
      aria-label="Close"
      class="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-scrim/50 text-white"
    >
      <Icon icon={faXmark} />
    </button>
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
