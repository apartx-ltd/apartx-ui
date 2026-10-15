<script>
  import { cn } from '../utils/cn';

  let {
    children,
    start,
    end,
    href,
    onclick,
    active = false,
    // M3 disabled: строка не кликается и не подсвечивается, содержимое — на 38 %.
    // Ссылка рисуется div'ом без href (у <a> атрибута disabled нет). Отметка — data-disabled:
    // aria-disabled роли listitem не положен. Кнопки в end-слоте хост гасит сам.
    disabled = false,
    class: className,
    ...restProps
  } = $props();

  let interactive = $derived(!disabled && (!!href || !!onclick));
</script>

{#if href && !disabled}
  <a
    {href}
    class={cn(
      'flex items-center gap-3 px-4 py-3 text-body-lg text-on-surface no-underline',
      interactive && 'hover:bg-on-surface/8 active:bg-on-surface/12 cursor-pointer',
      active && 'bg-secondary-container text-on-secondary-container',
      className
    )}
    role="listitem"
    {...restProps}
  >
    {#if start}<div class="flex-shrink-0 flex items-center">{@render start()}</div>{/if}
    <div class="flex-1 min-w-0">{@render children()}</div>
    {#if end}<div class="flex-shrink-0 flex items-center">{@render end()}</div>{/if}
  </a>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={cn(
      'flex items-center gap-3 px-4 py-3 text-body-lg text-on-surface',
      interactive && 'hover:bg-on-surface/8 active:bg-on-surface/12 cursor-pointer',
      active && 'bg-secondary-container text-on-secondary-container',
      disabled && 'opacity-38',
      className
    )}
    role="listitem"
    data-disabled={disabled || undefined}
    onclick={disabled ? undefined : onclick}
    {...restProps}
  >
    {#if start}<div class="flex-shrink-0 flex items-center">{@render start()}</div>{/if}
    <div class="flex-1 min-w-0">{@render children()}</div>
    {#if end}<div class="flex-shrink-0 flex items-center">{@render end()}</div>{/if}
  </div>
{/if}
