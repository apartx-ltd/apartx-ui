import type { MapProvider } from './types';

// Placeholder provider. Implement against the Google Maps JS API following the
// same MapProvider contract as `yandexProvider`, then register it below.
const notImplemented = (): never => {
  throw new Error('Google maps provider is not implemented yet');
};

export const googleProvider: MapProvider = {
  name: 'google',
  load: notImplemented,
  createMap: notImplemented,
  search: notImplemented,
};
