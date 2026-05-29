<script>
  import { cn } from '../utils/cn';

  let { variant = 'rectangular', class: className, ...restProps } = $props();

  const variants = {
    rectangular: 'rounded-sm',
    circular: 'rounded-full',
    text: 'rounded-xs h-4 w-full',
  };
</script>

<div
  class={cn(
    'bg-surface-variant animate-pulse',
    variants[variant],
    className
  )}
  {...restProps}
></div>
