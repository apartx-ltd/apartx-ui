<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<div
  class={cn('flex flex-col', className)}
  role="list"
  {...restProps}
>
  {@render children()}
</div>
