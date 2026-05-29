<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<footer
  class={cn(
    'flex-shrink-0 bg-surface z-10',
    className
  )}
  {...restProps}
>
  {@render children()}
</footer>
