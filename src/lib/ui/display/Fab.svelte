<script>
  import { cn } from '../utils/cn';

  let {
    children,
    position = 'bottom-end',
    class: className,
    ...restProps
  } = $props();

  // Кнопка привязана к вьюпорту, поэтому поднимается на корневую копию нижнего инсета:
  // внутри Page унаследованная переменная уже обнулена (AGENTS.md → «Safe-area»).
  const bottom = 'fixed bottom-[calc(1rem+var(--safe-area-root-bottom,0px))]';
  const positions = {
    'bottom-end': `${bottom} right-4`,
    'bottom-start': `${bottom} left-4`,
    'bottom-center': `${bottom} left-1/2 -translate-x-1/2`,
  };
</script>

<div
  class={cn(positions[position], 'z-20', className)}
  {...restProps}
>
  {@render children()}
</div>
