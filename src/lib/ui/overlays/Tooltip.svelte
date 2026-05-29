<script>
  import { cn } from '../utils/cn';

  let { children, text = '', class: className, ...restProps } = $props();
  let visible = $state(false);
</script>

<div
  class={cn('relative inline-flex', className)}
  onmouseenter={() => { visible = true; }}
  onmouseleave={() => { visible = false; }}
  onfocusin={() => { visible = true; }}
  onfocusout={() => { visible = false; }}
  {...restProps}
>
  {@render children()}
  {#if visible && text}
    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-xs bg-inverse-surface text-inverse-on-surface text-label-sm whitespace-nowrap z-50 pointer-events-none">
      {text}
    </div>
  {/if}
</div>
