<script>
  import { cn } from '../utils/cn';

  let {
    children,
    variant = 'elevated',
    class: className,
    ...restProps
  } = $props();

  const variants = {
    elevated: 'bg-surface shadow-level-1',
    filled: 'bg-surface-variant',
    outlined: 'bg-surface border border-outline-variant',
  };
</script>

<div
  class={cn(
    'rounded-md',
    variants[variant],
    className
  )}
  {...restProps}
>
  {@render children()}
</div>
