<script lang="ts">
  // Test double for MapView/MapMarker in MapPreview.dom.test.ts. jsdom cannot load a map SDK,
  // and the test is about the PREVIEW's contract (what mounts when), not about the map itself.
  let { center, zoom, coordinates, children }: any = $props();
</script>

<div
  data-testid="map-stub"
  data-lat={center?.lat ?? coordinates?.lat}
  data-lng={center?.lng ?? coordinates?.lng}
  data-zoom={zoom}
>
  {@render children?.()}
</div>
