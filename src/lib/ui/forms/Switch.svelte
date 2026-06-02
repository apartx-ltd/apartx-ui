<script>
  import { cn } from '../utils/cn';

  let {
    checked = $bindable(false),
    label = '',
    disabled = false,
    class: className,
    onchange,
    ...restProps
  } = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.({ target: { checked } });
  }

  const labelId = $props.id();
</script>

<div
  class={cn(
    'inline-flex items-center gap-3 cursor-pointer',
    disabled && 'opacity-38 cursor-not-allowed',
    className
  )}
>
  <div
    class={cn(
      'relative w-12 h-7 rounded-full transition-colors',
      checked ? 'bg-primary' : 'bg-surface-variant border-2 border-outline'
    )}
    onclick={toggle}
    role="switch"
    aria-checked={checked}
    aria-labelledby={label ? labelId : undefined}
    tabindex="0"
    onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }}
    {...restProps}
  >
    <div
      class={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full transition-all',
        checked
          ? 'left-6 w-5 h-5 bg-on-primary'
          : 'left-1 w-4 h-4 bg-outline'
      )}
    ></div>
  </div>
  {#if label}
    <span id={labelId} class="text-body-md text-on-surface">{label}</span>
  {/if}
</div>
