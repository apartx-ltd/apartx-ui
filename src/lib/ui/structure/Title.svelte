<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<h1
  class={cn(
    'text-title-lg text-on-surface truncate',
    className
  )}
  {...restProps}
>
  {@render children()}
</h1>
