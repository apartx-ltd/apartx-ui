<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<div
  class={cn(
    'flex flex-col flex-1 min-h-0 overflow-hidden bg-background text-on-background',
    className
  )}
  {...restProps}
>
  {@render children()}
</div>
