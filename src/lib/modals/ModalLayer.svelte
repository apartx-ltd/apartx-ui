<script lang="ts">
  // Per-instance stacking provider for one open modal. <ModalOutlet> wraps each
  // stack entry in this, passing a depth-derived z band; descendant overlays
  // (Dialog/BottomSheet) read it via getOverlayLayer() and render at that z so
  // a deeper modal always sits above a shallower one. Renders nothing itself.
  import { setOverlayLayer } from '../ui/overlays/layer-context';

  let { z, children } = $props();

  // Reactive getter so a depth change (a lower modal closing shifts indices)
  // re-flows the z of the overlays already mounted under this layer.
  setOverlayLayer({
    get z() {
      return z;
    },
  });
</script>

{@render children?.()}
