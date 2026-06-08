<script lang="ts">
  import { untrack } from 'svelte';
  import { getMapHandleAccessor } from './context';
  import type { ClusterPoint, ClustererHandle, MarkerHandle } from './providers/types';

  /**
   * A clustering layer on the enclosing `<MapView>`. Renders no DOM itself —
   * it attaches a native clusterer to the map via context. Pins and cluster
   * bubbles are built by the `renderMarker` / `renderCluster` callbacks (plain
   * DOM, matching the underlying SDK's model), so consumers fully own pin look.
   *
   * Provider-agnostic: if the active provider exposes no clustering, this
   * transparently degrades to one plain marker per point.
   */
  let {
    points = [],
    gridSize,
    renderMarker,
    renderCluster,
    onPickMarker,
    onPickCluster,
  }: {
    points?: ClusterPoint[];
    /** Grid size in pixels for grid clustering (provider default if omitted). */
    gridSize?: number;
    renderMarker: (point: ClusterPoint) => HTMLElement;
    renderCluster: (points: ClusterPoint[]) => HTMLElement;
    onPickMarker?: (point: ClusterPoint) => void;
    onPickCluster?: (points: ClusterPoint[]) => void;
  } = $props();

  const getMap = getMapHandleAccessor();

  let handle = $state<ClustererHandle | null>(null);
  let usingFallback = $state(false);
  let fallbackMarkers: MarkerHandle[] = [];

  function clearFallback() {
    for (const m of fallbackMarkers) m.destroy();
    fallbackMarkers = [];
  }

  function buildFallback(map: NonNullable<ReturnType<typeof getMap>>, pts: ClusterPoint[]) {
    clearFallback();
    for (const p of pts) {
      const m = map.addMarker({
        coordinates: p.coordinates,
        element: renderMarker(p),
        onClick: onPickMarker ? () => onPickMarker(p) : undefined,
      });
      fallbackMarkers.push(m);
    }
  }

  // Attach to the map. Depends on `map` only; the initial point set is read
  // untracked so a changing `points` updates in place (see the effect below)
  // rather than tearing down and recreating the whole layer.
  $effect(() => {
    const map = getMap();
    if (!map) return;

    let disposed = false;
    const initial = untrack(() => points);

    if (typeof map.addClusterer === 'function') {
      map
        .addClusterer({ points: initial, gridSize, renderMarker, renderCluster, onPickMarker, onPickCluster })
        .then((h) => {
          if (disposed) {
            h.destroy();
            return;
          }
          handle = h;
        })
        .catch((err) => {
          // Clusterer SDK module failed to load → degrade to plain markers.
          console.error('[MapClusterer] clusterer unavailable, using plain markers', err);
          if (disposed) return;
          usingFallback = true;
          buildFallback(map, untrack(() => points));
        });
    } else {
      usingFallback = true;
      buildFallback(map, initial);
    }

    return () => {
      disposed = true;
      handle?.destroy();
      handle = null;
      clearFallback();
      usingFallback = false;
    };
  });

  // Push point-set changes to the live layer. Clusterer updates in place;
  // the fallback rebuilds its markers (degraded path — acceptable cost).
  $effect(() => {
    const pts = points;
    const map = getMap();
    if (handle) {
      handle.update(pts);
    } else if (usingFallback && map) {
      buildFallback(map, pts);
    }
  });
</script>
