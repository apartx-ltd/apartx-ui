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

  function handleChange(e) {
    checked = e.target.checked;
    onchange?.(e);
  }
</script>

<label
  class={cn(
    'inline-flex items-center gap-2 cursor-pointer',
    disabled && 'opacity-38 cursor-not-allowed',
    className
  )}
>
  <input
    type="checkbox"
    {checked}
    {disabled}
    class="w-5 h-5 rounded-xs accent-primary cursor-pointer"
    onchange={handleChange}
    {...restProps}
  />
  {#if label}
    <span class="text-body-md text-on-surface">{label}</span>
  {/if}
</label>
