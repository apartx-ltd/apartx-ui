<script>
  import { cn } from '../utils/cn';

  let { children, padding = false, class: className, ...restProps } = $props();
</script>

<main
  class={cn(
    'flex-1 overflow-y-auto overflow-x-hidden relative',
    padding && 'p-4',
    className
  )}
  {...restProps}
>
  {@render children()}
</main>
