<script>
  import { cn } from '../utils/cn';

  let { children, start, end, class: className, ...restProps } = $props();
</script>

<div
  class={cn(
    'flex items-center gap-2 px-2 min-h-14',
    className
  )}
  {...restProps}
>
  {#if start}
    <div class="shrink-0 flex items-center">
      {@render start()}
    </div>
  {/if}

  <div class="flex-1 flex items-center min-w-0">
    {@render children()}
  </div>

  {#if end}
    <div class="shrink-0 flex items-center">
      {@render end()}
    </div>
  {/if}
</div>
