import type {
  ClusterPoint,
  ClustererHandle,
  ClustererOptions,
  LngLat,
  MapHandle,
  MapLayerType,
  MapProvider,
  MapProviderConfig,
  MapViewOptions,
  MarkerHandle,
  MarkerOptions,
  SearchResult,
} from './types';
import { resolveControls } from './controls';

// Yandex Maps JS API v3 is delivered as a CDN script that installs the global
// `ymaps3`. We load it once and adapt its objects to the kit's MapHandle.
// Search uses the HTTP Geocoder API (no extra SDK module to import).

declare global {
  // The v3 global. Typed loosely here; full types come from @yandex/ymaps3-types.
  // eslint-disable-next-line no-var
  var ymaps3: any;
}

const SCRIPT_ID = 'apartx-ui-ymaps3';
let loadPromise: Promise<void> | null = null;

// The clusterer is a separately-versioned ymaps3 add-on, lazy-imported on first
// use (cached for the page lifetime). `ymaps3.import` ships with NO loaders
// registered, so importing an official package fails with "no loader for pkg"
// unless we first point it at a CDN that serves the npm package.
const CLUSTERER_PKG = '@yandex/ymaps3-clusterer@0.0.1';
let clustererCdnRegistered = false;
let clustererModulePromise: Promise<any> | null = null;
function importClustererModule(): Promise<any> {
  if (!clustererModulePromise) {
    if (!clustererCdnRegistered) {
      globalThis.ymaps3.import.registerCdn('https://cdn.jsdelivr.net/npm/{package}', CLUSTERER_PKG);
      clustererCdnRegistered = true;
    }
    clustererModulePromise = globalThis.ymaps3.import(CLUSTERER_PKG);
    clustererModulePromise.catch(() => { clustererModulePromise = null; });
  }
  return clustererModulePromise;
}

// GeoJSON Feature shape the clusterer consumes; `id` ties a feature back to its
// ClusterPoint so callbacks/renderers receive the original consumer payload.
function pointToFeature(p: ClusterPoint) {
  return {
    type: 'Feature',
    id: p.id,
    geometry: { type: 'Point', coordinates: [p.coordinates.lng, p.coordinates.lat] },
    properties: {},
  };
}

function loadScript(config: MapProviderConfig): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Yandex maps can only load in the browser'));
      return;
    }
    if ((globalThis as any).ymaps3) {
      resolve();
      return;
    }

    const lang = config.lang ?? 'en_US';
    const key = config.apiKey ? `apikey=${encodeURIComponent(config.apiKey)}&` : '';
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/v3/?${key}lang=${encodeURIComponent(lang)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Drop the failed script so a later load() (e.g. once an apikey is
      // supplied) can retry instead of reusing this rejected promise.
      script.remove();
      reject(
        new Error(
          config.apiKey
            ? 'Failed to load Yandex Maps v3 (check the API key / network)'
            : 'Yandex Maps requires an API key — none was provided',
        ),
      );
    };
    document.head.appendChild(script);
  });

  // Reset the cache on failure so the next call can retry with new credentials.
  loadPromise.catch(() => { loadPromise = null; });

  return loadPromise;
}

function makeDefaultPin(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    'width:20px;height:20px;border-radius:50% 50% 50% 0;background:var(--color-primary,#6750a4);' +
    'transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer';
  return el;
}

export const yandexProvider: MapProvider = {
  name: 'yandex',

  async load(config) {
    await loadScript(config);
    await globalThis.ymaps3.ready;
  },

  async createMap(container: HTMLElement, options: MapViewOptions): Promise<MapHandle> {
    const ymaps3 = globalThis.ymaps3;
    const {
      YMap,
      YMapDefaultSchemeLayer,
      YMapDefaultSatelliteLayer,
      YMapDefaultFeaturesLayer,
      YMapMarker,
      YMapControls,
      YMapScaleControl,
      YMapListener,
    } = ymaps3;

    const controls = resolveControls(options.controls);
    const map = new YMap(container, {
      location: { center: [options.center.lng, options.center.lat], zoom: options.zoom },
      // Theme the YMap itself, not just the scheme layer: the copyright/
      // distribution/control chrome follows YMap.theme. Without it the chrome
      // stays light (white control bg) while it inherits the app's text colour
      // (white in dark mode) → white-on-white "Открыть Яндекс Карты".
      theme: options.theme ?? 'light',
      // The bottom "© Яндекс / Открыть Яндекс Карты" block is YMap's copyright
      // chrome — toggled natively here, not via provider-specific CSS.
      copyrights: controls.attribution,
      // Escape hatch: raw YMap props for the long tail, merged last so they win.
      ...(options.providerOptions?.yandex ?? {}),
    });

    // Base layers: scheme (vector "map") is default; satellite is created lazily
    // on first switch. Theme applies to the scheme layer.
    const schemeLayer = new YMapDefaultSchemeLayer({ theme: options.theme ?? 'light' });
    map.addChild(schemeLayer);
    map.addChild(new YMapDefaultFeaturesLayer({}));

    let satelliteLayer: any = null;
    let layer: MapLayerType = 'map';

    // Track zoom so the kit zoom control can step it without reading SDK state.
    let curZoom = options.zoom;

    // Native scale bar; zoom/geolocation/layer are kit-rendered M3 controls.
    if (controls.scale) {
      const scaleControls = new YMapControls({ position: 'bottom left' });
      scaleControls.addChild(new YMapScaleControl({}));
      map.addChild(scaleControls);
    }

    // Report camera at gesture end so the consumer can persist map position.
    // `map.center`/`map.zoom` are the live getters; sync curZoom too so the kit
    // zoom control stays in step after a user pinch/scroll-zoom.
    if (options.onCameraChange) {
      const cameraListener = new YMapListener({
        layer: 'any',
        onActionEnd: () => {
          const [lng, lat] = map.center;
          curZoom = map.zoom;
          options.onCameraChange!({ center: { lng, lat }, zoom: map.zoom });
        },
      });
      map.addChild(cameraListener);
    }

    return {
      native: map,
      setCenter(center: LngLat, zoom?: number) {
        curZoom = zoom ?? curZoom;
        map.update({ location: { center: [center.lng, center.lat], zoom: curZoom } });
      },
      setTheme(theme) {
        // Tiles (scheme layer) and chrome (YMap) both follow the theme.
        schemeLayer.update({ theme });
        map.update({ theme });
      },
      zoomIn() {
        curZoom = Math.min(curZoom + 1, 21);
        map.update({ location: { zoom: curZoom, duration: 200 } });
      },
      zoomOut() {
        curZoom = Math.max(curZoom - 1, 0);
        map.update({ location: { zoom: curZoom, duration: 200 } });
      },
      getLayer() {
        return layer;
      },
      availableLayers(): MapLayerType[] {
        return ['map', 'satellite'];
      },
      setLayer(next: MapLayerType) {
        const target: MapLayerType = next === 'satellite' ? 'satellite' : 'map';
        if (target === layer) return;
        if (target === 'satellite') {
          if (!satelliteLayer) satelliteLayer = new YMapDefaultSatelliteLayer({});
          map.removeChild(schemeLayer);
          map.addChild(satelliteLayer);
        } else {
          if (satelliteLayer) map.removeChild(satelliteLayer);
          map.addChild(schemeLayer);
        }
        layer = target;
      },
      addMarker(opts: MarkerOptions): MarkerHandle {
        const el = opts.element ?? makeDefaultPin();
        if (opts.onClick) el.addEventListener('click', opts.onClick);
        const marker = new YMapMarker(
          {
            coordinates: [opts.coordinates.lng, opts.coordinates.lat],
            draggable: opts.draggable ?? false,
            onDragEnd: opts.onDragEnd
              ? (coords: [number, number]) => opts.onDragEnd!({ lng: coords[0], lat: coords[1] })
              : undefined,
          },
          el,
        );
        map.addChild(marker);
        return {
          setCoordinates(c: LngLat) {
            marker.update({ coordinates: [c.lng, c.lat] });
          },
          destroy() {
            map.removeChild(marker);
          },
        };
      },
      async addClusterer(opts: ClustererOptions): Promise<ClustererHandle> {
        const { YMapClusterer, clusterByGrid } = await importClustererModule();

        // Live id→point index so the renderer/click callbacks always resolve the
        // current payload, including after update().
        let index = new Map<string, ClusterPoint>(opts.points.map((p) => [p.id, p]));

        const markerFactory = (feature: any) => {
          const point = index.get(String(feature.id));
          const el = point ? opts.renderMarker(point) : makeDefaultPin();
          if (point && opts.onPickMarker) {
            el.addEventListener('click', () => opts.onPickMarker!(point));
          }
          return new YMapMarker({ coordinates: feature.geometry.coordinates }, el);
        };

        const clusterFactory = (coordinates: [number, number], features: any[]) => {
          const points = features
            .map((f) => index.get(String(f.id)))
            .filter((p): p is ClusterPoint => Boolean(p));
          const el = opts.renderCluster(points);
          if (opts.onPickCluster) {
            el.addEventListener('click', () => opts.onPickCluster!(points));
          }
          return new YMapMarker({ coordinates }, el);
        };

        const clusterer = new YMapClusterer({
          method: clusterByGrid({ gridSize: opts.gridSize ?? 64 }),
          features: opts.points.map(pointToFeature),
          marker: markerFactory,
          cluster: clusterFactory,
        });
        map.addChild(clusterer);

        return {
          update(points: ClusterPoint[]) {
            index = new Map(points.map((p) => [p.id, p]));
            clusterer.update({ features: points.map(pointToFeature) });
          },
          destroy() {
            map.removeChild(clusterer);
          },
        };
      },
      destroy() {
        map.destroy();
      },
    };
  },

  async search(query: string, config: MapProviderConfig): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const lang = (config.lang ?? 'en_US').split('_')[0];
    const url =
      `https://geocode-maps.yandex.ru/1.x/?format=json&lang=${encodeURIComponent(lang)}` +
      (config.apiKey ? `&apikey=${encodeURIComponent(config.apiKey)}` : '') +
      `&geocode=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yandex geocoder error: ${res.status}`);
    const json = await res.json();
    const members = json?.response?.GeoObjectCollection?.featureMember ?? [];

    return members.map((m: any): SearchResult => {
      const obj = m.GeoObject;
      const [lng, lat] = String(obj.Point.pos).split(' ').map(Number);
      return {
        title: obj.name,
        subtitle: obj.description,
        coordinates: { lng, lat },
      };
    });
  },
};
