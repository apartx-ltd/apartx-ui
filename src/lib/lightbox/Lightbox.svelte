<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import 'viewerjs/dist/viewer.css';
  import { getOverlayLayer } from '../ui/overlays/layer-context';

  type LightboxImage = { src: string; alt?: string };

  /**
   * Declarative image lightbox — a thin Svelte 5 wrapper around `viewerjs`
   * (zoom / pan / rotate / keyboard navigation come for free). viewerjs is an
   * implementation detail: drive the viewer with `images` + `bind:open` /
   * `bind:index`. The component renders only a visually-hidden gallery; keep your
   * own visible thumbnails and, on click, set `index` + `open = true`.
   *
   * @example
   *   let open = $state(false);
   *   let index = $state(0);
   *   <button onclick={() => { index = 0; open = true; }}>…thumbnail…</button>
   *   <Lightbox images={photos} bind:open bind:index />
   */
  let {
    images,
    open = $bindable(false),
    index = $bindable(0),
    onClose,
    options,
  }: {
    /** Images to show, in order. */
    images: LightboxImage[];
    /** Show/hide the viewer. Bindable — viewerjs-driven closes flip it back to false. */
    open?: boolean;
    /** Which image to open at (starting index). Bindable; not written back as the user navigates inside the viewer. */
    index?: number;
    /** Fires when the viewer closes (ESC / backdrop / close button / `open=false`). */
    onClose?: () => void;
    /** Escape hatch merged into `new Viewer(el, { ...defaults, ...options })`. Pass a STABLE reference — read once when the viewer is built. */
    options?: Record<string, any>;
  } = $props();

  // viewerjs is browser-only and heavy → loaded lazily (SSR-safe, mirrors how
  // Carousel registers swiper on mount). Until it resolves, no instance exists.
  let ViewerCtor: typeof import('viewerjs').default | null = $state(null);
  let galleryEl: HTMLUListElement | undefined = $state();
  // Plain (non-reactive) instance refs: the open/index effect must NOT re-run
  // when these change — only when `open`/`index` do.
  let viewer: import('viewerjs').default | null = null;
  let shown = false;

  // Layer-aware z-index: sit above the overlay that opened us. viewerjs's default
  // (2015) already clears the kit's small z-bands (modal registry BASE 60 / STEP
  // 10); this makes "above the dialog" explicit and robust if a host raises z.
  const layer = getOverlayLayer();
  const zIndex = $derived(layer ? Math.max(2015, layer.z + 10) : 2015);

  onMount(async () => {
    const mod = await import('viewerjs');
    ViewerCtor = mod.default;
  });

  // viewerjs fires custom DOM events on the bound element. `hidden` = the viewer
  // finished closing (covers ESC / backdrop / its own close button) → sync the
  // binding and notify the consumer.
  function onHidden() {
    shown = false;
    if (open) open = false;
    onClose?.();
  }

  // Show the viewer at image `i`, clamped into range. No-op for an empty set, so
  // `shown` only ever flips true when the viewer actually showed (viewerjs's
  // view() silently ignores out-of-range / empty indices, which would otherwise
  // desync `shown` and wedge the open/close logic).
  function openAt(i: number) {
    if (!viewer || images.length === 0) return;
    viewer.view(Math.max(0, Math.min(i, images.length - 1)));
    shown = true;
  }

  // (Re)build the Viewer when the ctor becomes ready, the gallery element exists,
  // or the image set changes. Only `images` (plus ctor/element) is a dependency:
  // `zIndex` and `options` are read via untrack so a layer-band change or a new
  // inline `options` object can't tear down and rebuild a live viewer mid-use.
  $effect(() => {
    void images;
    const Ctor = ViewerCtor;
    const el = galleryEl;
    if (!Ctor || !el) return;

    viewer?.destroy();
    shown = false;
    viewer = new Ctor(el, untrack(() => ({ inline: false, focus: false, zIndex, ...options })));
    el.addEventListener('hidden', onHidden);

    // Honour an `open` that was set before the instance existed.
    if (untrack(() => open)) openAt(untrack(() => index));

    return () => {
      el.removeEventListener('hidden', onHidden);
      viewer?.destroy();
      viewer = null;
      shown = false;
    };
  });

  // React to open/index changes. Reads of `viewer`/`shown`/`images` are
  // intentionally untracked so this effect's only deps are `open` and `index`.
  $effect(() => {
    const o = open;
    const i = index;
    untrack(() => {
      if (!viewer) return;
      if (o) openAt(i); // open at / switch to image i (clamped; sets shown)
      else if (shown) viewer.hide();
    });
  });
</script>

<!-- Visually-hidden gallery viewerjs binds to. Clipped to 0×0 (not display:none)
     so the <img> elements stay in the DOM for viewerjs to enumerate. The visible
     UI lives in the consumer; this only feeds the viewer. -->
<ul
  bind:this={galleryEl}
  aria-hidden="true"
  style="position:absolute;width:0;height:0;overflow:hidden;clip:rect(0 0 0 0);"
>
  {#each images as image, i (i)}
    <li><img src={image.src} alt={image.alt ?? ''} /></li>
  {/each}
</ul>
