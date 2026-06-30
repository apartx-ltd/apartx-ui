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
    /** Active / starting image index. Bindable. */
    index?: number;
    /** Fires when the viewer closes (ESC / backdrop / close button / `open=false`). */
    onClose?: () => void;
    /** Escape hatch: merged into `new Viewer(el, { ...defaults, ...options })`. */
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

  function openAt(i: number) {
    if (!viewer) return;
    viewer.view(i); // in modal mode, view() shows the viewer at that image
    shown = true;
  }

  // (Re)build the Viewer when the ctor becomes ready, the gallery element exists,
  // or the image set changes. `void images` registers the dependency so a changed
  // image set tears down and rebuilds (the hidden <li> list has already been
  // re-rendered by the time this effect runs).
  $effect(() => {
    void images;
    const Ctor = ViewerCtor;
    const el = galleryEl;
    if (!Ctor || !el) return;

    viewer?.destroy();
    shown = false;
    viewer = new Ctor(el, { inline: false, focus: false, zIndex, ...options });
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

  // React to open/index changes. Reads of `viewer`/`shown` are intentionally
  // untracked (plain vars) so this effect's only deps are `open` and `index`.
  $effect(() => {
    const o = open;
    const i = index;
    untrack(() => {
      if (!viewer) return;
      if (o && !shown) openAt(i);
      else if (o && shown) viewer.view(i); // already open → switch image
      else if (!o && shown) viewer.hide();
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
