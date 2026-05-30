<script lang="ts">
  import { ScrollArea as BitsScrollArea } from 'bits-ui';
  import { cn } from '../utils/cn';

  /**
   * Styled scroll container with M3-themed overlay scrollbars (bits-ui).
   * Wrap any overflowing content; set a height/max-height via `class`.
   *
   * @example
   * <ScrollArea class="h-64">
   *   …long content…
   * </ScrollArea>
   */
  let {
    children,
    orientation = 'vertical',
    type = 'hover',
    class: className,
    viewportClass,
    ...restProps
  }: {
    children: any;
    orientation?: 'vertical' | 'horizontal' | 'both';
    type?: 'auto' | 'always' | 'scroll' | 'hover';
    class?: string;
    viewportClass?: string;
    [key: string]: any;
  } = $props();

  const showVertical = $derived(orientation === 'vertical' || orientation === 'both');
  const showHorizontal = $derived(orientation === 'horizontal' || orientation === 'both');
</script>

{#snippet scrollbar(o: 'vertical' | 'horizontal')}
  <BitsScrollArea.Scrollbar
    orientation={o}
    class={cn(
      'flex touch-none select-none bg-transparent p-0.5 transition-colors',
      o === 'vertical' ? 'w-2.5 h-full' : 'h-2.5 w-full flex-col',
    )}
  >
    <BitsScrollArea.Thumb class="flex-1 rounded-full bg-on-surface/30 hover:bg-on-surface/50 transition-colors" />
  </BitsScrollArea.Scrollbar>
{/snippet}

<BitsScrollArea.Root {type} class={cn('relative overflow-hidden', className)} {...restProps}>
  <BitsScrollArea.Viewport class={cn('h-full w-full', viewportClass)}>
    {@render children()}
  </BitsScrollArea.Viewport>
  {#if showVertical}{@render scrollbar('vertical')}{/if}
  {#if showHorizontal}{@render scrollbar('horizontal')}{/if}
  {#if orientation === 'both'}
    <BitsScrollArea.Corner />
  {/if}
</BitsScrollArea.Root>
