<script lang="ts">
  import Button from '../../ui/display/Button.svelte';
  import type { MapHandle } from '../providers/types';

  /**
   * Kit-rendered M3 "my location" control. Provider-agnostic by design: it uses
   * the browser Geolocation API and recentres via `MapHandle.setCenter`, so no
   * provider needs a native geolocation control.
   */
  let { handle, zoom = 15 }: { handle: MapHandle; zoom?: number } = $props();

  let busy = $state(false);

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    busy = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        busy = false;
        handle.setCenter({ lng: pos.coords.longitude, lat: pos.coords.latitude }, zoom);
      },
      () => {
        busy = false;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
</script>

<Button
  variant="icon"
  class="h-10 w-10 rounded-lg bg-surface-container shadow-level-2"
  onclick={locate}
  loading={busy}
  aria-label="My location"
>
  {#if !busy}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round" />
    </svg>
  {/if}
</Button>
