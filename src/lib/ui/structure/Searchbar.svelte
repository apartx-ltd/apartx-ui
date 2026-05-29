<script>
  import { cn } from '../utils/cn';

  let {
    value = $bindable(''),
    placeholder = 'Search...',
    class: className,
    oninput,
    ...restProps
  } = $props();

  function handleInput(e) {
    value = e.target.value;
    oninput?.(e);
  }
</script>

<div
  class={cn(
    'flex items-center gap-2 px-3 h-10 rounded-full',
    'bg-surface-variant text-on-surface-variant',
    className
  )}
  {...restProps}
>
  <svg class="w-5 h-5 flex-shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>

  <input
    type="text"
    class="flex-1 bg-transparent border-none outline-none text-body-md placeholder:text-on-surface-variant/60"
    {placeholder}
    {value}
    oninput={handleInput}
  />

  {#if value}
    <button
      type="button"
      class="w-5 h-5 flex-shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
      onclick={() => { value = ''; }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
