<script>
  import { cn } from '../utils/cn';
  import { safeTopFlow, safeTopStrip, safeBottomFlow } from '../utils/safe-area';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Page — контейнер у края экрана: отступает на --safe-area-inset-top/bottom и обнуляет
     переменные прямым детям, так что Header/Toolbar/Footer/вложенный Page внутри видят 0 и
     отступ не удваивают (AGENTS.md → «Safe-area»). Полоску под статус-баром красит цветом
     шапки (surface), а не своим background: в тёмных темах они расходятся; полоску под
     Footer докрашивает сам Footer. Нижняя навигация живёт в Footer оболочки-Page.
     Утилиты инсета идут в cn ПОСЛЕДНИМИ — иначе p-0 хоста их вычистит. На вебе
     переменные не заданы → 0. -->
<div
  class={cn(
    'flex flex-col flex-1 min-h-0 overflow-hidden bg-background text-on-background',
    className,
    safeTopFlow,
    safeTopStrip,
    safeBottomFlow
  )}
  {...restProps}
>
  {@render children()}
</div>
