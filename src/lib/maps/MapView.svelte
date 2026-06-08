<script lang="ts">
  import { untrack } from 'svelte';
  import { cn } from '../ui/utils/cn';
  import Loading from '../ui/display/Loading.svelte';
  import { getMapConfig, getProvider, setMapHandleAccessor } from './context';
  import type { LngLat, MapHandle } from './providers/types';

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
    class: className,
    onready,
    ...restProps
  }: {
    children?: any;
    loading?: any;
    showLoading?: boolean;
    center: LngLat;
    zoom?: number;
    class?: string;
    onready?: (handle: MapHandle) => void;
    [key: string]: any;
  } = $props();

  let container = $state<HTMLElement | null>(null);
  let handle = $state<MapHandle | null>(null);
  let error = $state<string>('');

  // Publish a getter so markers (whose effects read `handle`) react once ready.
  setMapHandleAccessor(() => handle);

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
        const start = untrack(() => ({ center, zoom, theme: cfg.config.theme }));
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

  // Recentre when inputs change (after the map exists).
  $effect(() => {
    if (handle) handle.setCenter(center, zoom);
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

<div class={cn('relative overflow-hidden', className)} {...restProps}>
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

  <!-- Markers register imperatively; they render no DOM of their own here. -->
  {#if children}{@render children()}{/if}
</div>
