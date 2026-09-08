import { describe, it, expect } from 'vitest';
import { staticMapUrl } from './static';

const ALMATY = { lng: 76.889709, lat: 43.238949 };
const SIZE = { width: 300, height: 200 };

/** Params are compared decoded: URLSearchParams percent-encodes `,` `|` `~`, providers accept it. */
function params(url: string) {
  return new URL(url).searchParams;
}

describe('staticMapUrl — yandex', () => {
  const config = { staticApiKey: 'static-key', apiKey: 'js-key' };

  it('builds a v1 URL with lng,lat order and comma-separated size', () => {
    const url = staticMapUrl('yandex', { center: ALMATY, zoom: 16, size: SIZE }, config)!;
    expect(new URL(url).origin + new URL(url).pathname).toBe('https://static-maps.yandex.ru/v1');
    expect(params(url).get('ll')).toBe('76.889709,43.238949');
    expect(params(url).get('z')).toBe('16');
    expect(params(url).get('size')).toBe('300,200');
  });

  it('prefers the dedicated static key over the JS-API key', () => {
    const url = staticMapUrl('yandex', { center: ALMATY, zoom: 16, size: SIZE }, config)!;
    expect(params(url).get('apikey')).toBe('static-key');
  });

  it('falls back to the JS-API key when no static key is configured', () => {
    const url = staticMapUrl('yandex', { center: ALMATY, zoom: 16, size: SIZE }, { apiKey: 'js-key' })!;
    expect(params(url).get('apikey')).toBe('js-key');
  });

  it('joins markers with ~ and maps kit colours to pm2 tokens', () => {
    const url = staticMapUrl('yandex', {
      center: ALMATY, zoom: 16, size: SIZE,
      markers: [{ coordinates: ALMATY }, { coordinates: { lng: 76.9, lat: 43.3 }, color: 'blue' }],
    }, config)!;
    expect(params(url).get('pt')).toBe('76.889709,43.238949,pm2rdm~76.9,43.3,pm2blm');
  });

  it('passes lang and the dark theme through', () => {
    const url = staticMapUrl('yandex', {
      center: ALMATY, zoom: 16, size: SIZE, lang: 'ru_RU', theme: 'dark',
    }, config)!;
    expect(params(url).get('lang')).toBe('ru_RU');
    expect(params(url).get('theme')).toBe('dark');
  });

  it('omits theme when light', () => {
    const url = staticMapUrl('yandex', {
      center: ALMATY, zoom: 16, size: SIZE, theme: 'light',
    }, config)!;
    expect(params(url).has('theme')).toBe(false);
  });

  // Probed 2026-09-08: v1 accepts `scale` and ignores it (scale=2 still returned 300×200).
  // Retina therefore means asking for a bigger image; 650×450 is the hard ceiling (700×460 → 400).
  it('renders retina by asking for a bigger image, never by a scale parameter', () => {
    const url = staticMapUrl('yandex', { center: ALMATY, zoom: 16, size: SIZE, scale: 2 }, config)!;
    expect(params(url).get('size')).toBe('600,400');
    expect(params(url).has('scale')).toBe(false);
  });

  it('drops back to 1x when the doubled size would exceed the 650×450 ceiling', () => {
    const url = staticMapUrl('yandex', {
      center: ALMATY, zoom: 16, size: { width: 400, height: 200 }, scale: 2,
    }, config)!;
    expect(params(url).get('size')).toBe('400,200');
  });

  it('clamps an oversized base request to the ceiling', () => {
    const url = staticMapUrl('yandex', {
      center: ALMATY, zoom: 16, size: { width: 900, height: 600 }, scale: 1,
    }, config)!;
    expect(params(url).get('size')).toBe('650,450');
  });

  it('returns null without a key and without usable coordinates', () => {
    expect(staticMapUrl('yandex', { center: ALMATY, zoom: 16, size: SIZE }, {})).toBeNull();
    expect(staticMapUrl('yandex', { center: undefined as any, zoom: 16, size: SIZE }, config)).toBeNull();
    expect(staticMapUrl('yandex', { center: { lng: NaN, lat: 43.2 }, zoom: 16, size: SIZE }, config)).toBeNull();
  });
});
