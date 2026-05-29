<script>
  import { cn } from '../utils/cn';

  let {
    children,
    selected = false,
    onclick,
    class: className,
    ...restProps
  } = $props();
</script>

<button
  type="button"
  class={cn(
    'inline-flex items-center gap-1 px-3 h-8 rounded-xs text-label-lg transition-colors cursor-pointer',
    selected
      ? 'bg-secondary-container text-on-secondary-container'
      : 'border border-outline text-on-surface hover:bg-on-surface/8',
    className
  )}
  {onclick}
  {...restProps}
>
  {@render children()}
</button>
