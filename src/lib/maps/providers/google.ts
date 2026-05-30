import type {
  LngLat,
  MapHandle,
  MapProvider,
  MapProviderConfig,
  MapViewOptions,
  MarkerHandle,
  MarkerOptions,
  SearchResult,
} from './types';

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

export const googleProvider: MapProvider = {
  name: 'google',

  async load(config) {
    await loadScript(config);
  },

  async createMap(container: HTMLElement, options: MapViewOptions): Promise<MapHandle> {
    const google = globalThis.google;
    const { Map } = await google.maps.importLibrary('maps');
    const markerLib = await google.maps.importLibrary('marker');
    const AdvancedMarkerElement = markerLib.AdvancedMarkerElement;

    const map = new Map(container, {
      center: { lat: options.center.lat, lng: options.center.lng },
      zoom: options.zoom,
      mapId: lastConfig.mapId ?? DEFAULT_MAP_ID,
      disableDefaultUI: false,
    });

    return {
      native: map,
      setCenter(center: LngLat, zoom?: number) {
        map.moveCamera({ center: { lat: center.lat, lng: center.lng }, zoom: zoom ?? options.zoom });
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
