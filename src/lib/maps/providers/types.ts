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

export interface MapHandle {
  setCenter(center: LngLat, zoom?: number): void;
  addMarker(options: MarkerOptions): MarkerHandle;
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
