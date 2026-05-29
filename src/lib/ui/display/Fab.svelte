<script>
  import { cn } from '../utils/cn';

  let {
    children,
    position = 'bottom-end',
    class: className,
    ...restProps
  } = $props();

  const positions = {
    'bottom-end': 'fixed bottom-4 right-4',
    'bottom-start': 'fixed bottom-4 left-4',
    'bottom-center': 'fixed bottom-4 left-1/2 -translate-x-1/2',
  };
</script>

<div
  class={cn(positions[position], 'z-20', className)}
  {...restProps}
>
  {@render children()}
</div>
