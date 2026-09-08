<script lang="ts">
  import { getMapConfigOptional } from './context';
  import { staticMapUrl, type StaticMapMarker } from './providers/static';
  import type { LngLat, MapProviderName, MapTheme } from './providers/types';

  /**
   * Static map image — one `<img>`, no SDK, no DOM work, SSR-safe.
   *
   * Standalone by design: `provider`/`apiKey` can be passed directly, which is what chat bubbles
   * do (no `<MapConfig>` anywhere near them). Inside a `<MapConfig>` the unset props fall back to
   * the context, so a wrapped subtree configures both maps at once.
   *
   * `size` is the CSS box you are filling; `scale` decides how many pixels are actually
   * requested (see providers/static.ts — Yandex has no working scale parameter).
   *
   * @example
   * <StaticMap provider="yandex" apiKey={key} center={{lng: 76.9, lat: 43.2}}
   *            zoom={16} size={{width: 300, height: 200}} alt="Location" />
   */
  let {
    provider,
    apiKey,
    center,
    zoom = 15,
    size,
    markers = [],
    lang,
    theme,
    scale = 2,
    alt = '',
    class: className = '',
    fallback,
    ...rest
  }: {
    provider?: MapProviderName;
    /** Overrides both context keys. Yandex expects its STATIC key here, Google its JS-API key. */
    apiKey?: string;
    center: LngLat | null | undefined;
    zoom?: number;
    size: { width: number; height: number };
    markers?: StaticMapMarker[];
    lang?: string;
    theme?: MapTheme;
    scale?: 1 | 2;
    alt?: string;
    class?: string;
    /** Rendered when there is nothing to show (no key, no coordinates, or the image failed). */
    fallback?: any;
    [key: string]: any;
  } = $props();

  const ctx = getMapConfigOptional();

  // Latched on the image's own error event: a provider can refuse a perfectly well-formed URL
  // (quota, an API not enabled on the project), and a broken-image box looks worse than nothing.
  let failed = $state(false);

  const url = $derived(
    staticMapUrl(
      provider ?? ctx?.provider ?? 'yandex',
      {
        center: center as LngLat,
        zoom,
        size,
        markers,
        lang: lang ?? ctx?.config.lang,
        theme: theme ?? ctx?.config.theme,
        scale,
      },
      {
        apiKey: apiKey ?? ctx?.config.staticApiKey ?? ctx?.config.apiKey,
        mapId: ctx?.config.mapId,
      },
    ),
  );

  // A new URL deserves a new attempt — otherwise one failure would blank the component for the
  // rest of its life (e.g. the user opens another property in the same chat).
  $effect(() => {
    url;
    failed = false;
  });
</script>

{#if url && !failed}
  <img src={url} {alt} class={className} loading="lazy" onerror={() => (failed = true)} {...rest} />
{:else if fallback}
  {@render fallback()}
{/if}
