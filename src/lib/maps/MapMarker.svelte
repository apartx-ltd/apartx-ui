<script lang="ts">
  import { getMapHandleAccessor } from './context';
  import type { LngLat, MarkerHandle } from './providers/types';

  /**
   * A marker on the enclosing `<MapView>`. Renders no DOM itself — it attaches
   * a native marker to the map via context. Reactive `coordinates` move it.
   * Provide a `children` snippet to use a custom DOM element as the pin.
   */
  let {
    children,
    coordinates,
    draggable = false,
    onClick,
    onDragEnd,
  }: {
    children?: any;
    coordinates: LngLat;
    draggable?: boolean;
    onClick?: () => void;
    onDragEnd?: (coords: LngLat) => void;
  } = $props();

  const getMap = getMapHandleAccessor();

  // Optional custom element rendered off-screen, then handed to the provider.
  let customEl = $state<HTMLElement | null>(null);

  let marker: MarkerHandle | null = null;

  $effect(() => {
    const map = getMap();
    if (!map) return;
    if (children && !customEl) return; // wait for the custom element to mount

    marker = map.addMarker({
      coordinates,
      element: customEl ?? undefined,
      draggable,
      onClick,
      onDragEnd,
    });

    return () => {
      marker?.destroy();
      marker = null;
    };
  });

  // Move an existing marker when coordinates change.
  $effect(() => {
    marker?.setCoordinates(coordinates);
  });
</script>

{#if children}
  <div class="hidden">
    <div bind:this={customEl}>{@render children()}</div>
  </div>
{/if}
