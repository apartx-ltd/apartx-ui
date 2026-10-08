<script lang="ts">
  // Хост для SSR-теста: снипет slide в render() не передать, поэтому он объявлен здесь.
  import Carousel from '../Carousel.svelte';

  let { items = [], withSlide = true }: { items?: { url: string; alt: string }[] | null; withSlide?: boolean } = $props();
</script>

{#if withSlide}
  <Carousel {items} class="h-64">
    {#snippet slide(item, i)}
      <img src={item.url} alt={item.alt} data-index={i} />
    {/snippet}
  </Carousel>
{:else}
  <Carousel class="h-64">
    <swiper-slide><img src="/child.jpg" alt="child" /></swiper-slide>
  </Carousel>
{/if}
