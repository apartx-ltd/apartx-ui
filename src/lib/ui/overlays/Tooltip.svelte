<script>
  import { cn } from '../utils/cn';

  // `open` — управляемая видимость: пузырь показывает хост по своему состоянию (подсказка после тапа),
  // hover/focus при этом не участвуют; без `open` — как раньше, по наведению и фокусу.
  // `align` — куда прижат пузырь: `center` над серединой якоря, `end` — к его правому краю (якорь у
  // правого края экрана, центрированный пузырь вылез бы за вьюпорт). `testid` — data-testid пузыря.
  let { children, text = '', open = undefined, align = 'center', testid = undefined, class: className, ...restProps } = $props();
  let hovered = $state(false);
  let visible = $derived(open ?? hovered);
</script>

<div
  class={cn('relative inline-flex', className)}
  onmouseenter={() => { hovered = true; }}
  onmouseleave={() => { hovered = false; }}
  onfocusin={() => { hovered = true; }}
  onfocusout={() => { hovered = false; }}
  {...restProps}
>
  {@render children()}
  {#if visible && text}
    <div
      role="tooltip"
      class={cn(
        'absolute bottom-full mb-2 px-2 py-1 rounded-xs bg-inverse-surface text-inverse-on-surface text-label-sm whitespace-nowrap z-50 pointer-events-none',
        align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
      )}
      data-testid={testid}
    >
      {text}
    </div>
  {/if}
</div>
