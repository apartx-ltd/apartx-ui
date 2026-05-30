<script lang="ts">
  import { cn } from '../utils/cn';
  import Loading from '../display/Loading.svelte';

  /**
   * Infinite scroll loader (IntersectionObserver, dependency-free).
   * Renders `children` followed by a sentinel; when the sentinel enters the
   * viewport and there is more data, `onLoadMore` fires. Guards against
   * re-entrant loads while `loading` is true.
   *
   * @example
   * <InfiniteScroll {hasMore} {loading} onLoadMore={fetchNext}>
   *   {#each rows as r}<Item>{r.name}</Item>{/each}
   * </InfiniteScroll>
   */
  let {
    children,
    hasMore = true,
    loading = false,
    onLoadMore,
    rootMargin = '200px',
    threshold = 0,
    loader,
    endMessage = '',
    class: className,
    ...restProps
  }: {
    children: any;
    hasMore?: boolean;
    loading?: boolean;
    onLoadMore?: () => void;
    /** Distance from the viewport edge at which to pre-fetch. */
    rootMargin?: string;
    threshold?: number;
    loader?: any;
    endMessage?: string;
    class?: string;
    [key: string]: any;
  } = $props();

  let sentinel = $state<HTMLElement | null>(null);

  // Find the nearest scrollable ancestor so the observer works both for
  // page-level scrolling (→ null, the viewport) and inner scroll containers.
  function closestScrollParent(node: HTMLElement | null): HTMLElement | null {
    let el = node?.parentElement ?? null;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }

  $effect(() => {
    const node = sentinel;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          onLoadMore?.();
        }
      },
      { root: closestScrollParent(node), rootMargin, threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  });
</script>

<div class={cn('flex flex-col', className)} {...restProps}>
  {@render children()}

  {#if hasMore}
    <div bind:this={sentinel} class="h-px w-full" aria-hidden="true"></div>
    <div class="flex justify-center py-4">
      {#if loader}
        {@render loader()}
      {:else if loading}
        <Loading />
      {/if}
    </div>
  {:else if endMessage}
    <div class="flex justify-center py-4 text-body-sm text-on-surface-variant">{endMessage}</div>
  {/if}
</div>
