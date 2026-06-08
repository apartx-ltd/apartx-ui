<script lang="ts">
  import Button from '../../ui/display/Button.svelte';
  import type { MapHandle } from '../providers/types';

  /**
   * Kit-rendered M3 zoom control. Provider-agnostic: drives the map through
   * `MapHandle.zoomIn/zoomOut`, so it looks identical on every provider.
   */
  let { handle }: { handle: MapHandle } = $props();
</script>

<div class="flex flex-col overflow-hidden rounded-lg bg-surface-container shadow-level-2">
  <Button variant="icon" class="h-9 w-9 rounded-none" onclick={() => handle.zoomIn?.()} aria-label="Zoom in">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </Button>
  <div class="mx-1.5 h-px bg-outline-variant"></div>
  <Button variant="icon" class="h-9 w-9 rounded-none" onclick={() => handle.zoomOut?.()} aria-label="Zoom out">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M5 12h14" />
    </svg>
  </Button>
</div>
