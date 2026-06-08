<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../ui/display/Button.svelte';
  import type { MapHandle, MapLayerType } from '../providers/types';

  /**
   * Kit-rendered M3 map-type switcher. Cycles through the provider's
   * `availableLayers()` via `MapHandle.setLayer`, so it only ever offers types
   * the active provider actually supports (Yandex map/satellite, Google
   * map/satellite/hybrid) — no lying toggles.
   */
  let { handle }: { handle: MapHandle } = $props();

  // `handle` is stable for this control's lifetime (MapView mounts it only once
  // the map exists), so snapshot the layer set at mount via untrack.
  const layers: MapLayerType[] = untrack(() => handle.availableLayers?.() ?? []);
  let current = $state<MapLayerType>(untrack(() => handle.getLayer?.() ?? layers[0] ?? 'map'));

  function cycle() {
    if (layers.length < 2) return;
    const i = layers.indexOf(current);
    current = layers[(i + 1) % layers.length];
    handle.setLayer?.(current);
  }
</script>

{#if layers.length > 1}
  <Button
    variant="icon"
    class="h-10 w-10 rounded-lg bg-surface-container shadow-level-2"
    onclick={cycle}
    aria-label="Switch map layer"
    title={current}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  </Button>
{/if}
