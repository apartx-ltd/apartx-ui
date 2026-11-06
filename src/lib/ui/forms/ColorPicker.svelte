<script lang="ts">
  import { cn } from '../utils/cn';
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import Icon from '../display/Icon.svelte';
  import Popover from '../display/Popover.svelte';
  import ColorPalette from './ColorPalette.svelte';
  import { DEFAULT_COLOR_PALETTE, normalizeHex } from './color-picker';

  /**
   * `ColorPalette` in a kit Popover. `variant="swatch"` — a round swatch trigger (rows, legends);
   * `variant="field"` — a field-looking trigger with label, HEX and chevron (forms).
   * `...restProps` land on the trigger button (e.g. `data-testid`).
   *
   * The trigger is our own button anchored via `customAnchor` (kit Popover forwards attributes
   * to its content, not to its bits trigger); the modal scrim covers it while open, so a second
   * click on the trigger closes the popover through the scrim.
   */
  let {
    value = $bindable(null),
    open = $bindable(false),
    defaultValue,
    palette = DEFAULT_COLOR_PALETTE,
    disabled = false,
    labels = {},
    onChange,
    variant = 'swatch',
    label = '',
    size = 'md',
    error = '',
    required = false,
    class: className,
    ...restProps
  }: {
    value?: string | null;
    open?: boolean;
    defaultValue: string;
    palette?: readonly string[];
    disabled?: boolean;
    labels?: { custom?: string; backToPalette?: string; reset?: string; hex?: string; default?: string };
    onChange?: (value: string | null) => void;
    variant?: 'swatch' | 'field';
    label?: string;
    size?: 'sm' | 'md';
    error?: string;
    required?: boolean;
    class?: string;
    [key: string]: any;
  } = $props();

  let anchor = $state<HTMLElement | null>(null);

  const shown = $derived((value ? normalizeHex(value) : null) ?? normalizeHex(defaultValue) ?? defaultValue);
  const isDefault = $derived(!value || normalizeHex(value) === null);

  function changed(next: string | null) {
    onChange?.(next);
    open = false;
  }

  // A click on the already-current swatch emits nothing but still dismisses the popover.
  function closeOnPick(e: MouseEvent) {
    if ((e.target as Element).closest('[data-swatch],[data-color-reset]')) open = false;
  }
</script>

<div data-color-picker class={cn(variant === 'field' ? 'flex flex-col gap-1' : 'inline-flex', className)}>
  {#if variant === 'field' && label}
    <span class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </span>
  {/if}

  <button
    bind:this={anchor}
    type="button"
    data-color-trigger
    aria-label={label || shown}
    aria-haspopup="dialog"
    aria-expanded={open}
    {disabled}
    onclick={() => (open = !open)}
    {...restProps}
    class={cn(
      'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-38 disabled:pointer-events-none',
      variant === 'swatch'
        ? cn('shrink-0 rounded-full border border-outline-variant', size === 'sm' ? 'h-5 w-5' : 'h-7 w-7')
        : cn(
            'flex items-center gap-3 px-3 h-12 rounded-xs border bg-transparent text-left transition-colors',
            error ? 'border-error' : 'border-outline focus-within:border-primary hover:border-on-surface',
          ),
    )}
    style={variant === 'swatch' ? `background:${shown}` : undefined}
  >
    {#if variant === 'field'}
      <span class="h-6 w-6 shrink-0 rounded-full border border-outline-variant" style="background:{shown}"></span>
      <span class="text-body-lg text-on-surface font-mono">{shown}</span>
      {#if isDefault}
        <span class="text-label-md text-on-surface-variant">{labels.default ?? 'default'}</span>
      {/if}
      <Icon icon={faChevronDown} class="ml-auto text-on-surface-variant" />
    {/if}
  </button>

  {#if variant === 'field' && error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}

  <Popover
    bind:open
    modal
    side="bottom"
    align="start"
    customAnchor={anchor}
    contentClass={cn('p-3', variant === 'field' && 'min-w-(--bits-popover-anchor-width)')}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div onclick={closeOnPick}>
      <ColorPalette bind:value {defaultValue} {palette} {disabled} {labels} onChange={changed} />
    </div>
  </Popover>
</div>
