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
  // Keyed by point id so updates can RECONCILE (add/remove only what changed)
  // instead of tearing down and recreating every marker. A full rebuild on each
  // `points` change makes all pins flicker whenever the set is re-derived —
  // selection toggling (id flips to `…__sel`), new search results, etc. Mirrors
  // how a real clusterer reuses unchanged markers: same id ⇒ keep its DOM, gone
  // id ⇒ destroy, new id ⇒ create. So an id flip churns only that one pin.
  let fallbackMarkers = new Map<string, MarkerHandle>();

  function clearFallback() {
    for (const m of fallbackMarkers.values()) m.destroy();
    fallbackMarkers.clear();
  }

  function syncFallback(map: NonNullable<ReturnType<typeof getMap>>, pts: ClusterPoint[]) {
    const nextIds = new Set(pts.map((p) => p.id));
    for (const [id, m] of fallbackMarkers) {
      if (nextIds.has(id)) continue;
      m.destroy();
      fallbackMarkers.delete(id);
    }
    for (const p of pts) {
      if (fallbackMarkers.has(p.id)) continue; // unchanged id → keep existing marker
      const m = map.addMarker({
        coordinates: p.coordinates,
        element: renderMarker(p),
        onClick: onPickMarker ? () => onPickMarker(p) : undefined,
      });
      fallbackMarkers.set(p.id, m);
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
          syncFallback(map, untrack(() => points));
        });
    } else {
      usingFallback = true;
      syncFallback(map, initial);
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
      syncFallback(map, pts);
    }
  });
</script>
