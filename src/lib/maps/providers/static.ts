import type { LngLat, MapProviderConfig, MapProviderName, MapTheme } from './types';

// Static map images. Unlike the interactive providers this module loads no SDK and touches no
// DOM — it only builds URLs. That keeps it SSR-safe (spaces renders the property page on the
// server) and unit-testable without a browser.
//
// NB: URLSearchParams percent-encodes `,` `|` and `~`. Both providers accept the encoded form
// (the hand-rolled call sites this replaces used the same serializers), so it is left as is.

export type StaticMarkerColor = 'red' | 'blue' | 'green' | 'orange';

/** One pin. `color` is a kit-level name; each provider maps it to its own token. */
export interface StaticMapMarker {
  coordinates: LngLat;
  color?: StaticMarkerColor;
}

export interface StaticMapOptions {
  center: LngLat;
  zoom: number;
  /** Required: Google refuses a request without `size`; Yandex would default to 450×450. */
  size: { width: number; height: number };
  markers?: StaticMapMarker[];
  /** Locale tag, e.g. 'ru_RU'. Google gets the part before '_'. */
  lang?: string;
  theme?: MapTheme;
  /**
   * 2 = retina. Google has a native `scale` parameter; Yandex does not (it accepts one and
   * ignores it), so there it means "request a 2× bigger image" — subject to its 650×450 cap.
   * `size` always describes the CSS box you are filling, never the pixels requested.
   */
  scale?: 1 | 2;
}

const YANDEX_COLOR: Record<StaticMarkerColor, string> = {
  red: 'rd', blue: 'bl', green: 'gn', orange: 'or',
};

// v1 caps a request at 650×450 and has NO working `scale` parameter — it accepts one and
// returns the base size anyway (probed 2026-09-08). Retina therefore means asking for a bigger
// image and letting CSS shrink it; a request that would not fit stays at 1x rather than being
// squashed into a different aspect ratio.
const YANDEX_MAX = { width: 650, height: 450 };

function yandexSize(size: { width: number; height: number }, scale: 1 | 2 | undefined) {
  const wanted = scale === 2 ? { width: size.width * 2, height: size.height * 2 } : size;
  const fits = wanted.width <= YANDEX_MAX.width && wanted.height <= YANDEX_MAX.height;
  if (fits) return wanted;
  return {
    width: Math.min(size.width, YANDEX_MAX.width),
    height: Math.min(size.height, YANDEX_MAX.height),
  };
}

function yandexStaticUrl(o: StaticMapOptions, apiKey: string): string {
  const size = yandexSize(o.size, o.scale);
  const params = new URLSearchParams({
    ll: `${o.center.lng},${o.center.lat}`,
    z: String(o.zoom),
    size: `${size.width},${size.height}`,
    apikey: apiKey,
  });
  if (o.lang) params.set('lang', o.lang);
  if (o.theme === 'dark') params.set('theme', 'dark');
  if (o.markers?.length) {
    // One `pt` parameter, points joined with `~`; `pm2<colour>m` is the medium pin.
    params.set('pt', o.markers
      .map((m) => `${m.coordinates.lng},${m.coordinates.lat},pm2${YANDEX_COLOR[m.color ?? 'red']}m`)
      .join('~'));
  }
  return `https://static-maps.yandex.ru/v1?${params}`;
}

function googleStaticUrl(o: StaticMapOptions, apiKey: string, mapId?: string): string {
  const params = new URLSearchParams({
    center: `${o.center.lat},${o.center.lng}`,
    zoom: String(o.zoom),
    size: `${o.size.width}x${o.size.height}`,
    key: apiKey,
  });
  // Google takes a bare language code ('ru'), not a locale tag ('ru_RU').
  if (o.lang) params.set('language', o.lang.split('_')[0]);
  // Unlike Yandex, Google's `scale` works, so the requested size stays the CSS size.
  if (o.scale && o.scale > 1) params.set('scale', String(o.scale));
  // Colour scheme comes from a cloud-styled Map ID; the Static API has no `theme`. With no
  // mapId configured, `theme` is a no-op here — mirroring how Yandex ignores `mapId`.
  if (mapId) params.set('map_id', mapId);
  for (const m of o.markers ?? []) {
    params.append('markers', `color:${m.color ?? 'red'}|${m.coordinates.lat},${m.coordinates.lng}`);
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

/**
 * Build a static map image URL, or `null` when it cannot be built — no API key, or no usable
 * coordinates. `null` is a normal outcome (a property may carry no geotag), not an error.
 *
 * Key resolution is per provider, because "which key" IS a provider difference: Yandex serves
 * static maps off a key separate from the JS-API one (and rejects the JS-API key outright), while
 * Google reuses the interactive key. So Yandex prefers `staticApiKey` and Google prefers `apiKey`,
 * each falling back to the other only when its own is missing.
 *
 * This matters for a subtree wrapped in one `<MapConfig>` carrying both keys: a shared
 * "staticApiKey wins" rule would hand Google the Yandex key and earn a 403.
 */
export function staticMapUrl(
  provider: MapProviderName,
  options: StaticMapOptions,
  config: MapProviderConfig,
): string | null {
  const apiKey = provider === 'google'
    ? config.apiKey || config.staticApiKey
    : config.staticApiKey || config.apiKey;
  if (!apiKey) return null;
  const { center } = options;
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  return provider === 'google'
    ? googleStaticUrl(options, apiKey, config.mapId)
    : yandexStaticUrl(options, apiKey);
}
