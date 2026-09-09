<script lang="ts">
  import { MapConfig, MapView, MapMarker, MapSearch, StaticMap, MapPreview, externalMapUrl } from '$lib/maps';
  import { Button } from '$lib/ui/display';
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
  // Yandex serves static maps off a key of its own — it rejects the JS-API key above.
  let yandexStaticKey = $state('');

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
    <TextField bind:value={yandexStaticKey} label="Yandex Static Maps key" placeholder="Static API key (separate from the one above)" />
  {:else}
    <TextField bind:value={googleKey} label="Google Maps API key" placeholder="Maps JavaScript API key" />
    <TextField bind:value={googleMapId} label="Google Map ID (optional)" placeholder="Defaults to DEMO_MAP_ID" />
  {/if}
</div>

<MapConfig {provider} {apiKey} staticApiKey={yandexStaticKey} lang="en_US" mapId={googleMapId}>
  <section class="mb-6 max-w-md">
    <h2 class="text-title-md mb-3">StaticMap (image, no SDK)</h2>
    <p class="text-body-sm text-on-surface-variant mb-3">
      No SDK, no DOM — just a URL and an <code>&lt;img&gt;</code>. Provider, key, language and
      theme come from this same <code>MapConfig</code>. <code>size</code> is the CSS box;
      <code>scale</code> decides the pixels requested (Yandex has no scale parameter, so it asks
      for a bigger image, capped at 650×450).
    </p>
    <StaticMap
      {center}
      markers={[{ coordinates: marker }]}
      zoom={14}
      size={{ width: 320, height: 200 }}
      alt="Static map"
      class="rounded-lg"
    >
      {#snippet fallback()}
        <div class="bg-surface-container text-on-surface-variant text-body-sm rounded-lg p-4">
          No key for this provider — paste one above.
        </div>
      {/snippet}
    </StaticMap>
  </section>

  <section class="mb-6 max-w-md">
    <h2 class="text-title-md mb-3">MapPreview (tap → live map)</h2>
    <p class="text-body-sm text-on-surface-variant mb-3">
      The static image above, made tappable: the tap opens a <code>Dialog</code> with
      <code>MapView</code>. Full-screen sheet under 600px, centred window above (override with
      <code>fullScreen</code>). MapView is imported on the first open only.
    </p>
    <MapPreview
      {center}
      markers={[{ coordinates: marker }]}
      zoom={14}
      size={{ width: 320, height: 200 }}
      alt="Map preview"
      title="Almaty"
      openLabel="Show on map"
      class="rounded-lg"
    >
      {#snippet footer()}
        <div class="p-4">
          <Button onclick={() => window.open(externalMapUrl(provider, center, 14)!, '_blank', 'noopener')}>
            Open in Maps
          </Button>
        </div>
      {/snippet}
    </MapPreview>
  </section>

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
