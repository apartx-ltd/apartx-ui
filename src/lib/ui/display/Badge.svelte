<script>
  import { cn } from '../utils/cn';

  let {
    children,
    variant = 'default',
    class: className,
    ...restProps
  } = $props();

  const variants = {
    default: 'bg-primary text-on-primary',
    secondary: 'bg-secondary text-on-secondary',
    error: 'bg-error text-on-error',
    success: 'bg-success text-on-success',
    warning: 'bg-warning text-on-warning',
    outline: 'bg-transparent border border-outline text-on-surface',
  };
</script>

<span
  class={cn(
    'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-label-sm font-medium',
    variants[variant],
    className
  )}
  {...restProps}
>
  {@render children()}
</span>
