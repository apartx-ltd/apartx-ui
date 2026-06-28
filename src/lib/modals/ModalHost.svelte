<script lang="ts">
  // Renders ONE open modal instance. Mounted by <ModalOutlet> inside a keyed
  // `{#each}` (key = instance.key), so this component's lifecycle is bound to that
  // one instance: it mounts when the instance is pushed and unmounts when it is
  // popped, and is never recreated by sibling stack changes.
  //
  // The lazy component is resolved ONCE into local `$state` rather than awaited
  // inline. An `{#await loadModal(...)}` re-mounts its `then` branch whenever this
  // host re-renders (e.g. when another modal is pushed/popped onto the stack),
  // which silently reset a parent modal's local state mid-flow — e.g. CartModal
  // lost its picked dates the instant the date-picker modal opened on top. With a
  // stable `Comp` reference the loaded component is mounted exactly once and
  // survives every sibling stack change.
  import { loadModal, closeInstance } from './registry.svelte';
  import ModalLayer from './ModalLayer.svelte';

  let { instance, z } = $props();

  let Comp = $state<any>(null);

  // Resolve the chunk once. `instance.id` is fixed for an instance, so this runs a
  // single time; the memoized loader in the registry dedupes the import across
  // instances of the same modal id.
  $effect(() => {
    let alive = true;
    loadModal(instance.id)?.then((mod) => {
      if (alive) Comp = mod?.default ?? null;
    });
    return () => {
      alive = false;
    };
  });
</script>

<ModalLayer {z}>
  {#if Comp}
    {@const ModalComponent = Comp}
    <ModalComponent {...instance.props} close={(result: any) => closeInstance(instance.key, result)} />
  {/if}
</ModalLayer>
