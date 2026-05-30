import { getContext, setContext } from 'svelte';
import type { MapHandle, MapProviderConfig } from './providers/types';
import { resolveProvider, type MapProviderName } from './providers';

const CONFIG_KEY = Symbol('apartx-map-config');
const MAP_KEY = Symbol('apartx-map-handle');

export interface MapConfigContext {
  provider: MapProviderName;
  config: MapProviderConfig;
}

export function setMapConfig(ctx: MapConfigContext) {
  setContext(CONFIG_KEY, ctx);
}

export function getMapConfig(): MapConfigContext {
  const ctx = getContext<MapConfigContext>(CONFIG_KEY);
  if (!ctx) throw new Error('Map components must be wrapped in <MapConfig>');
  return ctx;
}

export function getProvider() {
  const { provider } = getMapConfig();
  return resolveProvider(provider);
}

// Live map handle, published by <MapView> for descendant <MapMarker>s.
// A getter (not the value) so markers see the handle once the async map mounts.
export function setMapHandleAccessor(get: () => MapHandle | null) {
  setContext(MAP_KEY, get);
}

export function getMapHandleAccessor(): () => MapHandle | null {
  const get = getContext<() => MapHandle | null>(MAP_KEY);
  if (!get) throw new Error('<MapMarker> must be nested inside <MapView>');
  return get;
}
