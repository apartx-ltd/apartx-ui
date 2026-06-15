import type {
  ClusterPoint,
  ClustererHandle,
  ClustererOptions,
  LngLat,
  MapHandle,
  MapLayerType,
  MapProvider,
  MapProviderConfig,
  MapTheme,
  MapViewOptions,
  MarkerHandle,
  MarkerOptions,
  SearchResult,
} from './types';
import { resolveControls } from './controls';

// Google map-type ids ↔ the kit's provider-agnostic layer names.
const TO_GOOGLE_TYPE: Record<MapLayerType, string> = {
  map: 'roadmap',
  satellite: 'satellite',
  hybrid: 'hybrid',
};

// Google Maps JS API. The bootstrap script installs the global `google`; we
// then pull individual libraries via `google.maps.importLibrary(...)`.
// Adapts Google's objects to the kit's provider-agnostic MapHandle.

declare global {
  // eslint-disable-next-line no-var
  var google: any;
}

const SCRIPT_ID = 'apartx-ui-gmaps';
const CALLBACK = '__apartxGmapsReady';
// Google's documented sample Map ID — fine for demos; supply your own in prod.
const DEFAULT_MAP_ID = 'DEMO_MAP_ID';

let loadPromise: Promise<void> | null = null;
let lastConfig: MapProviderConfig = {};

function loadScript(config: MapProviderConfig): Promise<void> {
  lastConfig = config;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google Maps can only load in the browser'));
      return;
    }
    if ((globalThis as any).google?.maps) {
      resolve();
      return;
    }
    if (!config.apiKey) {
      reject(new Error('Google Maps requires an API key — none was provided'));
      return;
    }

    const params = new URLSearchParams({ key: config.apiKey, v: 'weekly', loading: 'async' });
    if (config.lang) params.set('language', config.lang.split('_')[0]);
    params.set('callback', CALLBACK);

    (globalThis as any)[CALLBACK] = () => resolve();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      script.remove();
      reject(new Error('Failed to load Google Maps (check the API key / network)'));
    };
    document.head.appendChild(script);
  });

  // Reset the cache on failure so a later load() can retry with new credentials.
  loadPromise.catch(() => { loadPromise = null; });

  return loadPromise;
}

// Clustering is NOT part of the Google Maps JS API — it ships as the separate
// @googlemaps/markerclusterer library. Mirroring the Yandex provider (which CDN-
// loads its clusterer add-on), we lazy-load the UMD bundle once and read the
// `markerClusterer` global. Pinned major version; jsDelivr is already an allowed
// script origin (the Yandex clusterer loads from there too).
const CLUSTERER_CDN = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2/dist/index.min.js';
let clustererLibPromise: Promise<any> | null = null;

function loadClustererLib(): Promise<any> {
  if ((globalThis as any).markerClusterer) return Promise.resolve((globalThis as any).markerClusterer);
  if (clustererLibPromise) return clustererLibPromise;

  clustererLibPromise = new Promise<any>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Marker clusterer can only load in the browser'));
      return;
    }
    const script = document.createElement('script');
    script.src = CLUSTERER_CDN;
    script.async = true;
    script.onload = () => {
      const lib = (globalThis as any).markerClusterer;
      if (lib) resolve(lib);
      else reject(new Error('Marker clusterer loaded but global is missing'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Failed to load Google marker clusterer'));
    };
    document.head.appendChild(script);
  });

  clustererLibPromise.catch(() => { clustererLibPromise = null; });
  return clustererLibPromise;
}

export const googleProvider: MapProvider = {
  name: 'google',

  async load(config) {
    await loadScript(config);
  },

  async createMap(container: HTMLElement, options: MapViewOptions): Promise<MapHandle> {
    const google = globalThis.google;
    // Alias to GoogleMap: destructuring as `Map` would shadow the built-in `Map`
    // for this whole closure (createMap's returned methods), so `new Map()` in
    // e.g. addClusterer would wrongly invoke the Google map constructor.
    const { Map: GoogleMap } = await google.maps.importLibrary('maps');
    const markerLib = await google.maps.importLibrary('marker');
    const AdvancedMarkerElement = markerLib.AdvancedMarkerElement;

    // Dark/light follows the kit theme via `colorScheme` — the only theming knob
    // for a vector map (legacy `styles` are ignored once a `mapId` is set, which we
    // need for AdvancedMarkers). The enum values ARE the strings 'LIGHT'/'DARK', so
    // fall back to literals if the (newer) ColorScheme enum is absent.
    const toColorScheme = (theme?: MapTheme) =>
      theme === 'dark'
        ? google.maps.ColorScheme?.DARK ?? 'DARK'
        : google.maps.ColorScheme?.LIGHT ?? 'LIGHT';

    const controls = resolveControls(options.controls);
    const map = new GoogleMap(container, {
      center: { lat: options.center.lat, lng: options.center.lng },
      zoom: options.zoom,
      mapId: lastConfig.mapId ?? DEFAULT_MAP_ID,
      colorScheme: toColorScheme(options.theme),
      // Normalized `controls` → Google's default UI. `disableDefaultUI` hides the
      // button chrome; individual controls can be re-enabled alongside it.
      disableDefaultUI: !controls.attribution,
      scaleControl: controls.scale,
      // Escape hatch: raw MapOptions for the long tail, merged last so they win.
      ...(options.providerOptions?.google ?? {}),
    });

    if (options.onCameraChange) {
      map.addListener('idle', () => {
        const c = map.getCenter();
        if (!c) return;
        options.onCameraChange!({ center: { lng: c.lng(), lat: c.lat() }, zoom: map.getZoom() ?? options.zoom });
      });
    }

    return {
      native: map,
      setCenter(center: LngLat, zoom?: number) {
        map.moveCamera({ center: { lat: center.lat, lng: center.lng }, zoom: zoom ?? options.zoom });
      },
      setTheme(theme: MapTheme) {
        // Best-effort live switch. Google applies `colorScheme` at init; recent SDKs
        // honour it via setOptions, older ones treat it as init-only (the map was
        // already created with the correct theme, so the common case is covered).
        map.setOptions({ colorScheme: toColorScheme(theme) });
      },
      zoomIn() {
        map.setZoom((map.getZoom() ?? options.zoom) + 1);
      },
      zoomOut() {
        map.setZoom((map.getZoom() ?? options.zoom) - 1);
      },
      getLayer(): MapLayerType {
        const id = map.getMapTypeId?.();
        return id === 'satellite' || id === 'hybrid' ? id : 'map';
      },
      availableLayers(): MapLayerType[] {
        return ['map', 'satellite', 'hybrid'];
      },
      setLayer(next: MapLayerType) {
        map.setMapTypeId(TO_GOOGLE_TYPE[next] ?? 'roadmap');
      },
      addMarker(opts: MarkerOptions): MarkerHandle {
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: opts.coordinates.lat, lng: opts.coordinates.lng },
          content: opts.element ?? undefined,
          gmpDraggable: opts.draggable ?? false,
        });
        if (opts.onClick) marker.addListener('click', opts.onClick);
        if (opts.draggable && opts.onDragEnd) {
          marker.addListener('dragend', () => {
            const p = marker.position;
            const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
            const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
            opts.onDragEnd!({ lng, lat });
          });
        }
        return {
          setCoordinates(c: LngLat) {
            marker.position = { lat: c.lat, lng: c.lng };
          },
          destroy() {
            marker.map = null;
          },
        };
      },
      async addClusterer(opts: ClustererOptions): Promise<ClustererHandle> {
        const { MarkerClusterer, SuperClusterAlgorithm } = await loadClustererLib();

        // id → AdvancedMarkerElement. update() reconciles by id (add/remove only
        // changed points); a selection-only change (same ids, new renderKey) is
        // applied IN PLACE — swap the affected marker's content, recolour the
        // affected cluster bubble — WITHOUT removing/adding markers, so the layer
        // never re-clusters and nothing flickers. Each marker carries its current
        // ClusterPoint (`__point`) and last-applied renderKey (`__renderKey`).
        const markersById = new Map<string, any>();

        const markerKey = (p: ClusterPoint) => p.renderKey ?? '';
        // A cluster's look depends on its members' renderKeys (e.g. one selected).
        const clusterKey = (pts: ClusterPoint[]) =>
          pts.map((p) => p.renderKey ?? '').sort().join('|');

        const makeMarker = (point: ClusterPoint) => {
          const m = new AdvancedMarkerElement({
            position: { lat: point.coordinates.lat, lng: point.coordinates.lng },
            content: opts.renderMarker(point),
            gmpClickable: !!opts.onPickMarker,
          });
          m.__point = point;
          m.__renderKey = markerKey(point);
          // AdvancedMarkerElement: 'gmp-click' (with gmpClickable) is the current
          // clickable API; plain 'click' is deprecated.
          if (opts.onPickMarker) m.addEventListener('gmp-click', () => opts.onPickMarker!(m.__point));
          return m;
        };

        for (const p of opts.points) markersById.set(p.id, makeMarker(p));

        const renderer = {
          render: ({ position, markers: clustered }: any) => {
            const points = (clustered ?? [])
              .map((m: any) => m.__point as ClusterPoint | undefined)
              .filter((p: ClusterPoint | undefined): p is ClusterPoint => Boolean(p));
            const m = new AdvancedMarkerElement({ position, content: opts.renderCluster(points) });
            m.__renderKey = clusterKey(points);
            return m;
          },
        };

        const clusterer = new MarkerClusterer({
          map,
          markers: [...markersById.values()],
          // SuperCluster clusters in geographic space, so panning at a fixed zoom
          // yields "unchanged" → the layer skips re-rendering (GridAlgorithm is
          // viewport-relative and re-renders on every pan → flicker).
          algorithm: new SuperClusterAlgorithm({ radius: opts.gridSize ?? 64 }),
          renderer,
          // Provide a click handler so the default (zoom-to-bounds) is replaced by
          // the kit's "pick the whole cluster" behaviour (opens the sheet).
          onClusterClick: opts.onPickCluster
            ? (_e: unknown, cluster: any) => {
                const points = (cluster.markers ?? [])
                  .map((m: any) => m.__point as ClusterPoint | undefined)
                  .filter((p: ClusterPoint | undefined): p is ClusterPoint => Boolean(p));
                opts.onPickCluster!(points);
              }
            : undefined,
        });

        // Recolour cluster bubbles in place when their members' renderKeys change
        // (e.g. a member got selected). No re-cluster → no flicker. Reads the live
        // `clusterer.clusters` layout from the last render (still valid: positions
        // are unchanged on a selection-only update).
        const refreshClusterBubbles = () => {
          for (const cluster of clusterer.clusters ?? []) {
            const bubble = cluster.marker;
            if (!bubble || (cluster.markers?.length ?? 0) <= 1) continue; // singles handled separately
            const pts = (cluster.markers ?? [])
              .map((m: any) => m.__point as ClusterPoint | undefined)
              .filter((p: ClusterPoint | undefined): p is ClusterPoint => Boolean(p));
            const key = clusterKey(pts);
            if (bubble.__renderKey === key) continue;
            bubble.content = opts.renderCluster(pts);
            bubble.__renderKey = key;
          }
        };

        return {
          update(points: ClusterPoint[]) {
            const nextIds = new Set(points.map((p) => p.id));
            const toRemove: any[] = [];
            for (const [id, m] of markersById) {
              if (nextIds.has(id)) continue;
              toRemove.push(m);
              markersById.delete(id);
            }
            const toAdd: any[] = [];
            for (const p of points) {
              const existing = markersById.get(p.id);
              if (!existing) {
                const m = makeMarker(p);
                markersById.set(p.id, m);
                toAdd.push(m);
                continue;
              }
              // Same id: refresh payload, and if the look changed (renderKey),
              // swap this one marker's content in place — no remove/add.
              existing.__point = p;
              const key = markerKey(p);
              if (existing.__renderKey !== key) {
                existing.content = opts.renderMarker(p);
                existing.__renderKey = key;
              }
            }
            // Only structural changes (real result add/remove) re-cluster.
            if (toRemove.length) clusterer.removeMarkers(toRemove, true);
            if (toAdd.length) clusterer.addMarkers(toAdd, true);
            if (toRemove.length || toAdd.length) clusterer.render();
            // Always reconcile cluster-bubble appearance (covers selection-only
            // updates, which intentionally skip the re-cluster above).
            refreshClusterBubbles();
          },
          destroy() {
            clusterer.clearMarkers();
            clusterer.setMap(null);
          },
        };
      },
      destroy() {
        // Google maps have no explicit destroy; dropping references is enough.
        container.replaceChildren();
      },
    };
  },

  async search(query: string, _config: MapProviderConfig): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const google = globalThis.google;
    const { Geocoder } = await google.maps.importLibrary('geocoding');
    const geocoder = new Geocoder();
    const { results } = await geocoder.geocode({ address: query });

    return (results ?? []).map((r: any): SearchResult => {
      const loc = r.geometry.location;
      return {
        title: r.formatted_address,
        subtitle: r.types?.[0],
        coordinates: { lng: loc.lng(), lat: loc.lat() },
      };
    });
  },
};
