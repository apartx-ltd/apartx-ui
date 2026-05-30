<script lang="ts">
  import { MapConfig, MapView, MapMarker, MapSearch } from '$lib/maps';
  import type { LngLat, SearchResult, MapProviderName } from '$lib/maps';
  import { TextField } from '$lib/ui/forms';
  import { Segment } from '$lib/ui/structure';

  // Provider switcher — the same components work against any provider; only
  // MapConfig's `provider` prop changes. MapView re-initialises on switch.
  let provider = $state<MapProviderName>('yandex');

  // Separate credentials per provider (different APIs, different keys).
  let yandexKey = $state('');
  let googleKey = $state('');
  let googleMapId = $state('');

  let apiKey = $derived(provider === 'yandex' ? yandexKey : googleKey);

  // Almaty.
  let center = $state<LngLat>({ lng: 76.945, lat: 43.238 });
  let marker = $state<LngLat>({ lng: 76.945, lat: 43.238 });
  let lastPick = $state<SearchResult | null>(null);

  function onSelect(r: SearchResult) {
    lastPick = r;
    center = r.coordinates;
    marker = r.coordinates;
  }
</script>

<h1 class="text-headline-md mb-6">Maps</h1>

<p class="text-body-md text-on-surface-variant mb-4 max-w-prose">
  Provider-agnostic map components (<code>apartx-ui/maps</code>). Components talk only to the
  <code>MapProvider</code> interface; <code>MapConfig</code> picks the implementation. Switch the
  provider below — the map, marker and search all re-bind to it with no other change.
</p>

<div class="mb-4 max-w-md">
  <Segment
    bind:value={provider}
    items={[
      { value: 'yandex', label: 'Yandex' },
      { value: 'google', label: 'Google' },
    ]}
  />
</div>

<div class="mb-4 flex max-w-md flex-col gap-3">
  {#if provider === 'yandex'}
    <TextField bind:value={yandexKey} label="Yandex API key" placeholder="JavaScript API & HTTP Geocoder key" />
  {:else}
    <TextField bind:value={googleKey} label="Google Maps API key" placeholder="Maps JavaScript API key" />
    <TextField bind:value={googleMapId} label="Google Map ID (optional)" placeholder="Defaults to DEMO_MAP_ID" />
  {/if}
</div>

<MapConfig {provider} {apiKey} lang="en_US" mapId={googleMapId}>
  <section class="mb-6 max-w-md">
    <h2 class="text-title-md mb-3">MapSearch (geocoder)</h2>
    <MapSearch {onSelect} placeholder="Search an address…" />
    {#if lastPick}
      <p class="text-body-sm text-on-surface-variant mt-2">
        picked <code>{lastPick.title}</code> → {lastPick.coordinates.lng.toFixed(3)}, {lastPick.coordinates.lat.toFixed(3)}
      </p>
    {/if}
  </section>

  <section class="mb-8 max-w-2xl">
    <h2 class="text-title-md mb-3">MapView + MapMarker — <code>{provider}</code></h2>
    <MapView {center} zoom={12} class="h-96 rounded-md border border-outline-variant">
      <MapMarker coordinates={marker} draggable onDragEnd={(c) => (marker = c)} />
    </MapView>
  </section>
</MapConfig>
