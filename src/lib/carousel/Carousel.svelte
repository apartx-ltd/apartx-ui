<script lang="ts">
  import { onMount } from 'svelte';
  import { cn } from '../ui/utils/cn';

  /**
   * Carousel over Swiper's web components (`swiper/element`). The custom
   * elements are registered once on mount (browser-only → SSR-safe). Pass
   * `items` plus a `slide` snippet, or arbitrary `children` of `<swiper-slide>`.
   *
   * @example
   * <Carousel items={photos} slidesPerView={1} navigation pagination loop>
   *   {#snippet slide(item)}
   *     <img src={item.url} alt={item.alt} class="w-full" />
   *   {/snippet}
   * </Carousel>
   */
  let {
    items = [],
    slide,
    children,
    slidesPerView = 1,
    spaceBetween = 16,
    navigation = false,
    pagination = false,
    loop = false,
    autoplayDelay = 0,
    class: className,
    ...restProps
  }: {
    items?: any[];
    slide?: any;
    children?: any;
    slidesPerView?: number | 'auto';
    spaceBetween?: number;
    navigation?: boolean;
    pagination?: boolean;
    loop?: boolean;
    /** Autoplay interval in ms; 0 disables autoplay. */
    autoplayDelay?: number;
    class?: string;
    [key: string]: any;
  } = $props();

  let ready = $state(false);

  onMount(async () => {
    // Register Swiper's custom elements lazily, browser-only.
    const { register } = await import('swiper/element/bundle');
    register();
    ready = true;
  });
</script>

{#if ready}
  <swiper-container
    class={cn('block', className)}
    slides-per-view={String(slidesPerView)}
    space-between={spaceBetween}
    navigation={navigation ? 'true' : 'false'}
    pagination={pagination ? 'true' : 'false'}
    loop={loop ? 'true' : 'false'}
    autoplay={autoplayDelay > 0 ? 'true' : 'false'}
    autoplay-delay={autoplayDelay || undefined}
    {...restProps}
  >
    {#if slide}
      {#each items as item, i (i)}
        <swiper-slide>{@render slide(item, i)}</swiper-slide>
      {/each}
    {:else if children}
      {@render children()}
    {/if}
  </swiper-container>
{:else}
  <!-- SSR / pre-register placeholder keeps layout height stable. -->
  <div class={cn('block', className)} aria-hidden="true"></div>
{/if}
