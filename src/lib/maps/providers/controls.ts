import type { MapControls } from './types';

export interface ResolvedControls {
  attribution: boolean;
  zoom: boolean;
  geolocation: boolean;
  scale: boolean;
  layer: boolean;
}

/**
 * Normalise the provider-agnostic `controls` option to concrete flags shared by
 * every provider and by the kit-rendered control overlay.
 *
 * - `false` → everything off.
 * - `true`/omitted → provider defaults: attribution only (no extra controls).
 * - object → per-control overrides (attribution defaults on, the rest off).
 */
export function resolveControls(controls: MapControls | undefined): ResolvedControls {
  const off: ResolvedControls = {
    attribution: false,
    zoom: false,
    geolocation: false,
    scale: false,
    layer: false,
  };
  if (controls === false) return off;
  if (controls == null || controls === true) return { ...off, attribution: true };
  return {
    attribution: controls.attribution ?? true,
    zoom: controls.zoom ?? false,
    geolocation: controls.geolocation ?? false,
    scale: controls.scale ?? false,
    layer: controls.layer ?? false,
  };
}
