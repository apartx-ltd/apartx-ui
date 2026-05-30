<script>
  import { cn } from '../utils/cn';

  /**
   * Inline button container — groups related actions with a consistent gap.
   * Typically dropped into a Toolbar `start`/`end` snippet or a Footer.
   *
   * @example
   * <Toolbar>
   *   {#snippet end()}
   *     <Buttons>
   *       <Button>Cancel</Button>
   *       <Button variant="filled">Save</Button>
   *     </Buttons>
   *   {/snippet}
   * </Toolbar>
   */
  let { children, class: className, ...restProps } = $props();
</script>

<div class={cn('flex items-center gap-2', className)} {...restProps}>
  {@render children?.()}
</div>
