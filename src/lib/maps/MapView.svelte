<script lang="ts">
  import { untrack } from 'svelte';
  import { cn } from '../ui/utils/cn';
  import Loading from '../ui/display/Loading.svelte';
  import { getMapConfig, getProvider, setMapHandleAccessor } from './context';
  import { resolveControls } from './providers/controls';
  import ZoomControl from './controls/ZoomControl.svelte';
  import GeolocationControl from './controls/GeolocationControl.svelte';
  import LayerControl from './controls/LayerControl.svelte';
  import type { LngLat, MapControls, MapHandle, MapViewOptions } from './providers/types';

  /**
   * Renders a provider map. SSR-safe: the SDK loads and the map is created on
   * mount. Descendant `<MapMarker>`s attach to it via context. Reactive
   * `center`/`zoom` recentre the map in place. A loading overlay covers the map
   * until it's ready (override via the `loading` snippet, or disable with
   * `showLoading={false}`).
   */
  let {
    children,
    loading,
    showLoading = true,
    center,
    zoom = 12,
    controls,
    controlsPosition = 'bottom-right',
    providerOptions,
    onCameraChange,
    class: className,
    onready,
    ...restProps
  }: {
    children?: any;
    loading?: any;
    showLoading?: boolean;
    center: LngLat;
    zoom?: number;
    /** Built-in UI controls: `false` disables all; object toggles individually. */
    controls?: MapControls;
    /** Corner for the kit-rendered controls overlay (zoom/geolocation/layer). */
    controlsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Escape hatch for provider-specific native options, keyed by provider. */
    providerOptions?: MapViewOptions['providerOptions'];
    onCameraChange?: MapViewOptions['onCameraChange'];
    class?: string;
    onready?: (handle: MapHandle) => void;
    [key: string]: any;
  } = $props();

  let container = $state<HTMLElement | null>(null);
  let handle = $state<MapHandle | null>(null);
  let error = $state<string>('');

  // Publish a getter so markers (whose effects read `handle`) react once ready.
  setMapHandleAccessor(() => handle);

  // Which controls to render. attribution/scale are applied natively inside the
  // provider's createMap; zoom/geolocation/layer are the kit-rendered overlay.
  const ctrl = $derived(resolveControls(controls));
  const controlsPosClass = $derived(
    ({
      'top-left': 'top-2 left-2 items-start',
      'top-right': 'top-2 right-2 items-end',
      'bottom-left': 'bottom-2 left-2 items-start',
      'bottom-right': 'bottom-2 right-2 items-end',
    } as const)[controlsPosition],
  );

  const cfg = getMapConfig();

  // (Re)create the map whenever the container or provider credentials change.
  // center/zoom are read untracked so panning doesn't tear down the map — that
  // is handled by the recentre effect below.
  $effect(() => {
    const el = container;
    const provider = cfg.provider;
    const apiKey = cfg.config.apiKey;
    const lang = cfg.config.lang;
    const mapId = cfg.config.mapId;
    if (!el) return;

    let disposed = false;
    error = '';
    (async () => {
      try {
        const p = getProvider();
        await p.load({ apiKey, lang, mapId });
        if (disposed) return;
        // theme read untracked too — switching it updates in place via the
        // effect below, not by tearing down and recreating the map.
        const start = untrack(() => ({ center, zoom, theme: cfg.config.theme, controls, providerOptions, onCameraChange }));
        const h = await p.createMap(el, start);
        if (disposed) { h.destroy(); return; }
        handle = h;
        onready?.(h);
      } catch (e) {
        if (!disposed) error = e instanceof Error ? e.message : String(e);
      }
    })();

    return () => {
      disposed = true;
      handle?.destroy();
      handle = null;
    };
  });

  // Recentre when inputs change (after the map exists). Guard against redundant
  // re-applies: when a pan writes the camera back through the URL into these
  // props, setCenter to the same place would re-fire the provider's gesture-end
  // event and ping-pong. Skip if within a small epsilon of the last applied.
  let lastApplied: { lng: number; lat: number; zoom: number } | null = null;
  $effect(() => {
    if (!handle) return;
    const c = center;
    const z = zoom;
    const same =
      lastApplied &&
      Math.abs(lastApplied.lng - c.lng) < 1e-6 &&
      Math.abs(lastApplied.lat - c.lat) < 1e-6 &&
      lastApplied.zoom === z;
    if (same) return;
    lastApplied = { lng: c.lng, lat: c.lat, zoom: z };
    handle.setCenter(c, z);
  });

  // Switch colour scheme in place when the theme config changes.
  $effect(() => {
    const theme = cfg.config.theme;
    if (handle?.setTheme && theme) handle.setTheme(theme);
  });

  export function getHandle(): MapHandle | null {
    return handle;
  }
</script>

<!-- `isolate` makes this an isolating stacking context so the provider's own
     chrome can't escape above sibling overlays. Yandex pins its copyright /
     "Открыть Яндекс Карты" link with a very high z-index; without isolation it
     competes in the root stacking context and renders ON TOP of app overlays
     (e.g. the BottomSheet at z-50). Isolating confines all map chrome
     beneath anything stacked outside the map — independent of the provider's
     internal z-index. The kit M3 controls (z-10) keep working inside this context. -->
<div class={cn('relative isolate overflow-hidden', className)} {...restProps}>
  <div bind:this={container} class="absolute inset-0"></div>

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-surface-variant text-body-md text-error p-4 text-center">
      {error}
    </div>
  {:else if showLoading && !handle}
    <!-- Overlay while the SDK loads / the map is being created. -->
    <div class="absolute inset-0 flex items-center justify-center bg-surface-variant">
      {#if loading}{@render loading()}{:else}<Loading />{/if}
    </div>
  {/if}

  <!-- Kit-rendered M3 controls overlay (zoom/geolocation/layer). The wrapper is
       click-through so map drag works in the gaps; each control re-enables
       pointer events. attribution/scale are native (handled in the provider). -->
  {#if handle && (ctrl.zoom || ctrl.geolocation || ctrl.layer)}
    <div class={cn('pointer-events-none absolute z-10 flex flex-col gap-2', controlsPosClass)}>
      {#if ctrl.layer}<div class="pointer-events-auto"><LayerControl {handle} /></div>{/if}
      {#if ctrl.geolocation}<div class="pointer-events-auto"><GeolocationControl {handle} /></div>{/if}
      {#if ctrl.zoom}<div class="pointer-events-auto"><ZoomControl {handle} /></div>{/if}
    </div>
  {/if}

  <!-- Markers register imperatively; they render no DOM of their own here. -->
  {#if children}{@render children()}{/if}
</div>
