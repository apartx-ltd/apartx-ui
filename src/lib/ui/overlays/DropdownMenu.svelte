<script>
  import { cn } from '../utils/cn';
  import Popover from '../display/Popover.svelte';

  // Меню — это kit Popover (bits-ui), а не свой fixed-портал. Прежний самодельный вариант
  // ставил меню строго под триггер без потолка высоты: у нижнего края оно уезжало за экран
  // и обрезалось. bits даёт flip/shift у краёв вьюпорта и потолок по свободному месту с
  // прокруткой, dismiss и Escape только верхнего слоя (меню внутри Dialog/Popover гасит
  // себя, а не родителя) и z над модалкой реестра. `modal` — скрим (клик мимо закрывает
  // меню и не доходит до того, что под ним) и участие в overlay-stack: back закрывает меню.
  let {
    children,
    trigger,
    open = $bindable(false),
    align = 'end',
    respectBack = true,
    class: className,
    ...restProps
  } = $props();
</script>

<div class={cn('relative inline-flex', className)} {...restProps}>
  <Popover
    bind:open
    modal
    {respectBack}
    side="bottom"
    {align}
    {trigger}
    contentClass="py-1 min-w-48"
    role="menu"
  >
    {@render children()}
  </Popover>
</div>
