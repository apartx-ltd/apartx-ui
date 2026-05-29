<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<div
  class={cn('px-4 py-2 text-label-lg text-on-surface-variant', className)}
  {...restProps}
>
  {@render children()}
</div>
