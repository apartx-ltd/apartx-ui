<script lang="ts">
  import { Popover as BitsPopover } from 'bits-ui';
  import { cn } from '../utils/cn';

  /**
   * Universal popover — a floating surface anchored to a trigger.
   * `PopoverJson` is a specialised instance of this pattern.
   *
   * Provide the anchor via the `trigger` snippet and the floating body via the
   * default `children` snippet. Optionally bind `open`.
   *
   * @example
   * <Popover side="bottom" align="start">
   *   {#snippet trigger()}
   *     <Button variant="outlined">Open</Button>
   *   {/snippet}
   *   <div class="p-3">Popover body</div>
   * </Popover>
   */
  let {
    children,
    trigger,
    open = $bindable(false),
    side = 'bottom',
    align = 'center',
    sideOffset = 4,
    trapFocus = true,
    triggerClass,
    contentClass,
    class: className,
    ...restProps
  }: {
    children: any;
    trigger?: any;
    open?: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
    trapFocus?: boolean;
    triggerClass?: string;
    contentClass?: string;
    class?: string;
    [key: string]: any;
  } = $props();
</script>

<BitsPopover.Root bind:open>
  {#if trigger}
    <BitsPopover.Trigger class={triggerClass}>
      {@render trigger()}
    </BitsPopover.Trigger>
  {/if}

  <BitsPopover.Content
    {side}
    {align}
    {sideOffset}
    {trapFocus}
    class={cn(
      'z-50 rounded-sm bg-surface shadow-level-3 border border-outline-variant overflow-hidden',
      className,
      contentClass,
    )}
    {...restProps}
  >
    {@render children()}
  </BitsPopover.Content>
</BitsPopover.Root>
