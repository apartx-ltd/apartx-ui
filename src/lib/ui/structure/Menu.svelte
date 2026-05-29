<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<nav
  class={cn(
    'flex flex-col h-full bg-surface overflow-hidden',
    className
  )}
  {...restProps}
>
  {@render children()}
</nav>
