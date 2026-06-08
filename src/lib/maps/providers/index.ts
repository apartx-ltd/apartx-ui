import type { MapProvider, MapProviderName } from './types';
import { yandexProvider } from './yandex';
import { googleProvider } from './google';

const registry: Record<MapProviderName, MapProvider> = {
  yandex: yandexProvider,
  google: googleProvider,
};

export function resolveProvider(name: MapProviderName): MapProvider {
  const provider = registry[name];
  if (!provider) throw new Error(`Unknown map provider: ${name}`);
  return provider;
}

export type * from './types';
export { yandexProvider, googleProvider };
