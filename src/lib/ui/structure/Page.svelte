<script>
  import { cn } from '../utils/cn';
  import { safeTopFlow, safeTopStrip } from '../utils/safe-area';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Page — контейнер у верхнего края экрана: отступает на --safe-area-inset-top и обнуляет
     переменную прямым детям, так что Header/Toolbar/вложенный Page внутри видят 0 и отступ
     не удваивают (AGENTS.md → «Safe-area»). Полоску под статус-баром красит цветом шапки
     (surface), а не своим background: в тёмных темах они расходятся. Утилиты инсета идут в
     cn ПОСЛЕДНИМИ — иначе p-0 хоста их вычистит. На вебе переменная не задана → 0. -->
<div
  class={cn(
    'flex flex-col flex-1 min-h-0 overflow-hidden bg-background text-on-background',
    className,
    safeTopFlow,
    safeTopStrip
  )}
  {...restProps}
>
  {@render children()}
</div>
