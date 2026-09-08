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

/**
 * Same context, but `null` instead of a throw when there is no `<MapConfig>` above. For
 * components that are useful standalone — `<StaticMap>` renders a plain <img> and is dropped
 * into chat bubbles that have no map wrapper anywhere near them.
 */
export function getMapConfigOptional(): MapConfigContext | null {
  return getContext<MapConfigContext>(CONFIG_KEY) ?? null;
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
