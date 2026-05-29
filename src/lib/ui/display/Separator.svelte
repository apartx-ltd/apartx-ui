<script>
  import { cn } from '../utils/cn';

  let { orientation = 'horizontal', class: className, ...restProps } = $props();
</script>

<div
  role="separator"
  class={cn(
    'bg-outline-variant flex-shrink-0',
    orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
    className
  )}
  {...restProps}
></div>
