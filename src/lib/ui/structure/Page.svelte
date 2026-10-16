<script>
  import { cn } from '../utils/cn';
  import { safeTopFlow, safeTopStrip, safeBottomFlow } from '../utils/safe-area';

  /**
   * edgeToEdge — opt-out: Page не отступает на инсеты, не красит полоску под статус-баром и
   * не обнуляет переменные детям. Для экранов, которые красят области под статус-баром и над
   * home indicator своим содержимым (тёмная шапка на своей подложке, лист до нижнего края,
   * карта во весь экран): Header внутри отступает сам, как вне контейнера, остальные дети
   * отбивают `--safe-area-inset-*` сами. Вертикальный padding хоста при этом не вычищается.
   */
  let { children, class: className, edgeToEdge = false, ...restProps } = $props();
</script>

<!-- Page — контейнер у края экрана: отступает на --safe-area-inset-top/bottom и обнуляет
     переменные прямым детям, так что Header/Toolbar/Footer/вложенный Page внутри видят 0 и
     отступ не удваивают (AGENTS.md → «Safe-area»). Полоску под статус-баром красит цветом
     шапки (surface), а не своим background: в тёмных темах они расходятся; полоску под
     Footer докрашивает сам Footer. Нижняя навигация живёт в Footer оболочки-Page.
     Утилиты инсета идут в cn ПОСЛЕДНИМИ — иначе p-0 хоста их вычистит. На вебе
     переменные не заданы → 0. С edgeToEdge инсеты целиком на детях. -->
<div
  class={cn(
    'flex flex-col flex-1 min-h-0 overflow-hidden bg-background text-on-background',
    className,
    !edgeToEdge && safeTopFlow,
    !edgeToEdge && safeTopStrip,
    !edgeToEdge && safeBottomFlow
  )}
  data-edge-to-edge={edgeToEdge || undefined}
  {...restProps}
>
  {@render children()}
</div>
