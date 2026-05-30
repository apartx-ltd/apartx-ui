<script lang="ts">
  import { setMapConfig } from './context';
  import type { MapProviderName } from './providers';

  /**
   * Map provider context. Wrap `MapView`/`MapMarker`/`MapSearch` in this once
   * (typically near the app root) to choose the provider and pass credentials.
   * Selecting another provider is a single prop change — components are
   * provider-agnostic (see providers/types.ts).
   *
   * @example
   * <MapConfig provider="yandex" apiKey={key} lang="en_US">
   *   <MapView center={{ lng: 76.9, lat: 43.2 }} zoom={12} class="h-96" />
   * </MapConfig>
   */
  let {
    children,
    provider = 'yandex',
    apiKey = '',
    lang = 'en_US',
  }: {
    children: any;
    provider?: MapProviderName;
    apiKey?: string;
    lang?: string;
  } = $props();

  // Reactive context object so descendants react if credentials change.
  const ctx = $state({ provider, config: { apiKey, lang } });
  $effect(() => {
    ctx.provider = provider;
    ctx.config = { apiKey, lang };
  });

  setMapConfig(ctx);
</script>

{@render children()}
