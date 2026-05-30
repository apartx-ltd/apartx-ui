<script lang="ts">
  import { MapConfig, MapView, MapMarker, MapSearch } from '$lib/maps';
  import type { LngLat, SearchResult } from '$lib/maps';
  import { TextField } from '$lib/ui/forms';

  // The Yandex SDK is CDN-loaded at runtime and needs an API key. Paste one to
  // see the live map; without it MapView shows a graceful error instead.
  let apiKey = $state('');

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
  <code>MapProvider</code> interface; <code>MapConfig</code> picks the implementation
  (<code>yandex</code> shipped, <code>google</code> stubbed). The Yandex JS API v3 loads from its
  CDN at runtime, so a key is required for a live map.
</p>

<div class="max-w-md mb-4">
  <TextField bind:value={apiKey} label="Yandex API key" placeholder="Paste to enable the live map" />
</div>

<MapConfig provider="yandex" {apiKey} lang="en_US">
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
    <h2 class="text-title-md mb-3">MapView + MapMarker</h2>
    <MapView {center} zoom={12} class="h-96 rounded-md border border-outline-variant">
      <MapMarker coordinates={marker} draggable onDragEnd={(c) => (marker = c)} />
    </MapView>
  </section>
</MapConfig>
