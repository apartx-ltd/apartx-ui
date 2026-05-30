<script lang="ts">
  import { onMount } from 'svelte';
  import { VList } from 'virtua/svelte';

  /**
   * Virtualized list (forward mode) on top of `virtua`'s `VList`.
   *
   * virtua measures dynamic row heights out of the box and preserves scroll
   * position on prepend via `shift` — the reason it's the single virtualization
   * primitive across the ApartX stack (see admin's MessagesList). For
   * chat/reverse/stick-to-bottom behaviour use the `ChatList` preset built on
   * top of this base.
   *
   * Imperative handle (via `bind:this`):
   *   scrollToIndex(index, opts?) · scrollTo(offset) · getScrollSize() · getViewportSize()
   *
   * @example
   * let list;
   * <VirtualList bind:this={list} data={rows} getKey={(r) => r.id} onscroll={onScroll}>
   *   {#snippet children(item, index)}<Row {item} />{/snippet}
   * </VirtualList>
   */
  let {
    data,
    items,
    getKey,
    children,
    shift = false,
    overscan,
    onscroll,
    class: className,
    ...restProps
  }: {
    /** Row data. `items` is accepted as an alias. */
    data?: any[];
    items?: any[];
    getKey?: (item: any, index: number) => string | number;
    children: any;
    /** Set true while prepending older items to keep scroll position. */
    shift?: boolean;
    overscan?: number;
    onscroll?: (offset: number) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  const rows = $derived(data ?? items ?? []);

  // virtua's VList measures the DOM and is not server-renderable; only mount it
  // in the browser. SSR/prerender emit a sized placeholder for layout stability.
  let mounted = $state(false);
  onMount(() => { mounted = true; });

  let vlist = $state<any>(null);

  export function scrollToIndex(index: number, opts?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }) {
    vlist?.scrollToIndex(index, opts);
  }
  export function scrollTo(offset: number) {
    vlist?.scrollTo(offset);
  }
  export function scrollBy(offset: number) {
    vlist?.scrollBy(offset);
  }
  export function getScrollSize(): number {
    return vlist?.getScrollSize?.() ?? 0;
  }
  export function getViewportSize(): number {
    return vlist?.getViewportSize?.() ?? 0;
  }
  export function getScrollOffset(): number {
    return vlist?.getScrollOffset?.() ?? 0;
  }
</script>

{#if mounted}
  <VList
    bind:this={vlist}
    data={rows}
    {getKey}
    {shift}
    {overscan}
    {onscroll}
    class={className}
    {...restProps}
  >
    {#snippet children(item, index)}
      {@render children(item, index)}
    {/snippet}
  </VList>
{:else}
  <div class={className} aria-hidden="true"></div>
{/if}
