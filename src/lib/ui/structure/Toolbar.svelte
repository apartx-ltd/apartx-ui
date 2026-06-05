<script>
  import { cn } from '../utils/cn';

  let { children, start, end, class: className, startClass, contentClass, endClass, ...restProps } = $props();
</script>

<div
  class={cn(
    'flex items-center gap-2 px-2 min-h-14',
    className
  )}
  {...restProps}
>
  {#if start}
    <div class={cn('shrink-0 flex items-center', startClass)}>
      {@render start()}
    </div>
  {/if}

  <div class={cn('flex-1 flex flex-wrap items-center gap-2 min-w-0', contentClass)}>
    {@render children()}
  </div>

  {#if end}
    <div class={cn('shrink-0 flex items-center', endClass)}>
      {@render end()}
    </div>
  {/if}
</div>
