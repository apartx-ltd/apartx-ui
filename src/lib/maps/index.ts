// Maps (provider pattern). Behind its own subpath (`apartx-ui/maps`) — the
// Yandex SDK is CDN-loaded at runtime, never bundled into other consumers.
//
// Choose a provider via <MapConfig provider="yandex" apiKey=… />; components
// only depend on the provider-agnostic interfaces in providers/types.ts.
export { default as MapConfig } from './MapConfig.svelte';
export { default as MapView } from './MapView.svelte';
export { default as MapMarker } from './MapMarker.svelte';
export { default as MapSearch } from './MapSearch.svelte';

export { resolveProvider, yandexProvider, googleProvider } from './providers';
export type { MapProviderName } from './providers';
export type {
  LngLat,
  MapProvider,
  MapProviderConfig,
  MapHandle,
  MarkerHandle,
  MarkerOptions,
  MapViewOptions,
  SearchResult,
} from './providers/types';
