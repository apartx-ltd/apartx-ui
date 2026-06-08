// Provider-agnostic map abstraction. Concrete providers (Yandex, Google, …)
// implement `MapProvider`; the kit components only ever talk to these
// interfaces, so swapping providers is a config change (see MapConfig).

export interface LngLat {
  lng: number;
  lat: number;
}

export interface MapViewOptions {
  center: LngLat;
  zoom: number;
}

export interface MapProviderConfig {
  /** Provider API key (Yandex apikey, Google key, …). */
  apiKey?: string;
  /** UI/results language, e.g. "en_US", "ru_RU". */
  lang?: string;
  /** Google Map ID — required for Advanced Markers. Ignored by other providers. */
  mapId?: string;
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
