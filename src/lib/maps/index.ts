// Maps (provider pattern). Behind its own subpath (`apartx-ui/maps`) — the
// Yandex SDK is CDN-loaded at runtime, never bundled into other consumers.
//
// Choose a provider via <MapConfig provider="yandex" apiKey=… />; components
// only depend on the provider-agnostic interfaces in providers/types.ts.
export { default as MapConfig } from './MapConfig.svelte';
export { default as MapView } from './MapView.svelte';
export { default as MapMarker } from './MapMarker.svelte';
export { default as MapClusterer } from './MapClusterer.svelte';
export { default as MapSearch } from './MapSearch.svelte';
// Static map image — no SDK, no DOM, SSR-safe; usable outside <MapConfig>.
export { default as StaticMap } from './StaticMap.svelte';
// Static map that opens the live map in a dialog on tap; MapView is imported on first open.
export { default as MapPreview } from './MapPreview.svelte';
export { staticMapUrl, externalMapUrl } from './providers/static';
export type { StaticMapOptions, StaticMapMarker, StaticMarkerColor } from './providers/static';

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
  MapTheme,
  MapControls,
  MapControlsConfig,
  MapLayerType,
  SearchResult,
  ClusterPoint,
  ClustererOptions,
  ClustererHandle,
} from './providers/types';
