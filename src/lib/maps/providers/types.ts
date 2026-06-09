// Provider-agnostic map abstraction. Concrete providers (Yandex, Google, …)
// implement `MapProvider`; the kit components only ever talk to these
// interfaces, so swapping providers is a config change (see MapConfig).

export interface LngLat {
  lng: number;
  lat: number;
}

export type MapTheme = 'light' | 'dark';

/** Camera snapshot reported by `onCameraChange` (gesture-end). */
export interface MapCamera {
  center: LngLat;
  zoom: number;
}

/** Registered provider keys. Single source — providers/index re-exports this. */
export type MapProviderName = 'yandex' | 'google';

/** Base map type for the layer switcher. Providers advertise their subset via `availableLayers()`. */
export type MapLayerType = 'map' | 'satellite' | 'hybrid';

/**
 * Provider-agnostic control toggles. Each provider maps these to native where
 * it can; the interactive ones (`zoom`/`geolocation`/`layer`) are rendered by
 * the kit as themed M3 controls driving the imperative `MapHandle` methods, so
 * they look identical across providers and fill gaps in native coverage.
 * `attribution`/`scale` are provider-native (passive chrome).
 */
export interface MapControlsConfig {
  /** Provider copyright/attribution block (Yandex: YMap `copyrights`). Default true. */
  attribution?: boolean;
  /** Zoom in/out buttons (kit-rendered M3). Default false. */
  zoom?: boolean;
  /** "My location" button (kit-rendered; uses the browser Geolocation API). Default false. */
  geolocation?: boolean;
  /** Scale bar (provider-native). Default false. */
  scale?: boolean;
  /** Map-type switcher map/satellite/… (kit-rendered M3). Default false. */
  layer?: boolean;
}

/** `false` disables every built-in control; an object toggles them individually. */
export type MapControls = boolean | MapControlsConfig;

export interface MapViewOptions {
  center: LngLat;
  zoom: number;
  /** Map colour scheme. Defaults to 'light' when omitted. */
  theme?: MapTheme;
  /**
   * Built-in UI controls. `true`/omitted shows the provider defaults;
   * `false` disables all of them; an object toggles individual controls.
   */
  controls?: MapControls;
  /**
   * Escape hatch for provider-specific native map options that have no
   * cross-provider equivalent (Yandex `behaviors`/`margin`, Google
   * `gestureHandling`/`styles`, …). Keyed by provider so a call site can
   * pre-fill several; only the active provider's entry is applied. Merged into
   * the native map AFTER the normalized props above, so a key here overrides
   * its normalized equivalent (last-wins). See each provider's native docs
   * (Yandex YMap props / Google MapOptions); the kit does not type these.
   */
  providerOptions?: Partial<Record<MapProviderName, Record<string, unknown>>>;
  /**
   * Fired once at the END of a user pan/zoom gesture with the resulting camera
   * (not during the drag, not on programmatic `setCenter`-driven idle in a tight
   * loop — providers emit on their native gesture-end/idle event). Consumers use
   * it to persist the map position (e.g. to the URL).
   */
  onCameraChange?: (camera: MapCamera) => void;
}

export interface MapProviderConfig {
  /** Provider API key (Yandex apikey, Google key, …). */
  apiKey?: string;
  /** UI/results language, e.g. "en_US", "ru_RU". */
  lang?: string;
  /** Google Map ID — required for Advanced Markers. Ignored by other providers. */
  mapId?: string;
  /** Map colour scheme ('light' | 'dark'). Defaults to 'light'. */
  theme?: MapTheme;
}

export interface MarkerOptions {
  coordinates: LngLat;
  /** Custom DOM element for the marker; providers supply a default pin if omitted. */
  element?: HTMLElement;
  draggable?: boolean;
  onClick?: () => void;
  onDragEnd?: (coords: LngLat) => void;
}

export interface MarkerHandle {
  setCoordinates(coords: LngLat): void;
  destroy(): void;
}

/** One clusterable point. `data` is an opaque consumer payload echoed back in callbacks. */
export interface ClusterPoint<T = any> {
  id: string;
  coordinates: LngLat;
  data?: T;
}

export interface ClustererOptions<T = any> {
  points: ClusterPoint<T>[];
  /** Grid size in pixels for grid clustering (provider default if omitted). */
  gridSize?: number;
  /** Build the DOM element for a single (unclustered) point. */
  renderMarker: (point: ClusterPoint<T>) => HTMLElement;
  /** Build the DOM element for a cluster of `points`. */
  renderCluster: (points: ClusterPoint<T>[]) => HTMLElement;
  onPickMarker?: (point: ClusterPoint<T>) => void;
  onPickCluster?: (points: ClusterPoint<T>[]) => void;
}

export interface ClustererHandle<T = any> {
  /** Replace the clustered point set in place. */
  update(points: ClusterPoint<T>[]): void;
  destroy(): void;
}

export interface MapHandle {
  setCenter(center: LngLat, zoom?: number): void;
  /** Switch the map colour scheme in place. Optional — providers may omit it. */
  setTheme?(theme: MapTheme): void;
  /** Step the zoom by one level. Drives the kit zoom control. Optional. */
  zoomIn?(): void;
  zoomOut?(): void;
  /** Current base map type. Optional — providers without alternates omit these. */
  getLayer?(): MapLayerType;
  setLayer?(layer: MapLayerType): void;
  /** Map types this provider supports; the kit layer control renders only these. */
  availableLayers?(): MapLayerType[];
  addMarker(options: MarkerOptions): MarkerHandle;
  /**
   * Add a clustering layer. Optional — providers without clustering omit it,
   * and the kit `<MapClusterer>` falls back to plain markers when absent.
   * Async because providers may lazy-load a clustering SDK module.
   */
  addClusterer?(options: ClustererOptions): Promise<ClustererHandle>;
  destroy(): void;
  /** The underlying native map object, for escape-hatch access. */
  readonly native: unknown;
}

export interface SearchResult {
  title: string;
  subtitle?: string;
  coordinates: LngLat;
}

export interface MapProvider {
  readonly name: string;
  /** Load the underlying SDK once (idempotent). */
  load(config: MapProviderConfig): Promise<void>;
  /** Create a map inside `container`. The SDK must already be loaded. */
  createMap(container: HTMLElement, options: MapViewOptions): Promise<MapHandle>;
  /** Free-text geocoding/search. Optional — providers may omit it. */
  search?(query: string, config: MapProviderConfig): Promise<SearchResult[]>;
}
