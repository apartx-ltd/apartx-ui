<script>
  import { cn } from '../utils/cn';

  let {
    value = $bindable(''),
    label = '',
    placeholder = '',
    error = '',
    type = 'text',
    disabled = false,
    required = false,
    start,
    end,
    class: className,
    oninput,
    ...restProps
  } = $props();

  let focused = $state(false);

  function handleInput(e) {
    value = e.target.value;
    oninput?.(e);
  }
</script>

<div class={cn('flex flex-col gap-1', className)}>
  {#if label}
    <label class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </label>
  {/if}

  <div
    class={cn(
      'flex items-center gap-2 px-3 h-12 rounded-xs border transition-colors',
      error
        ? 'border-error'
        : focused
          ? 'border-primary border-2'
          : 'border-outline hover:border-on-surface',
      disabled && 'opacity-38 pointer-events-none'
    )}
  >
    {#if start}
      <div class="flex-shrink-0 text-on-surface-variant">{@render start()}</div>
    {/if}

    <input
      {type}
      {value}
      {placeholder}
      {disabled}
      {required}
      class="flex-1 bg-transparent border-none outline-none text-body-lg text-on-surface placeholder:text-on-surface-variant/60 min-w-0"
      oninput={handleInput}
      onfocus={() => { focused = true; }}
      onblur={() => { focused = false; }}
      {...restProps}
    />

    {#if end}
      <div class="flex-shrink-0 text-on-surface-variant">{@render end()}</div>
    {/if}
  </div>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
