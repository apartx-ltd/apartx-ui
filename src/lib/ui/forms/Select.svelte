<script>
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../utils/cn';
  import { getOverlayLayer } from '../overlays/layer-context';
  import { useOverlay } from '../../hooks/useOverlay.svelte';

  // Built on the bits-ui Select primitive (mirrors Combobox). The popup portals to
  // <body> via BitsSelect.Portal so it escapes clipping ancestors — a kit <Dialog>
  // panel is `overflow-hidden` and its body `overflow-y-auto`, which used to cut off an
  // in-flow dropdown. As a real bits-ui dismissable layer it also joins the shared layer
  // stack, so a click on an option no longer reads as "outside" to a parent <Dialog>
  // (a body-portalled custom menu did, closing the modal when a bottom option fell below
  // the dialog's rect). z-index: inside a stacked overlay (modal registry injects a
  // layer) sit at `layer.z + 2` — above the dialog content, below any deeper modal;
  // otherwise keep bits' default `z-50`. No layer ⇒ backwards-compatible.
  const overlayLayer = getOverlayLayer();

  let {
    value = $bindable(''),
    label = '',
    options = [],
    error = '',
    placeholder = '',
    disabled = false,
    required = false,
    multiple = false,
    respectBack = true,
    class: className,
    onchange,
    ...restProps
  } = $props();

  let open = $state(false);

  useOverlay(() => open, () => { open = false; }, { respectBack });

  let displayText = $derived.by(() => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return '';
      if (arr.length <= 2) return arr.map(v => options.find(o => o.value === v)?.label ?? v).join(', ');
      return `${arr.length} selected`;
    }
    return options.find(o => o.value === value)?.label ?? '';
  });

  let hasValue = $derived(multiple ? Array.isArray(value) && value.length > 0 : !!value);

  // bits fires onValueChange only on user-driven selection — map it to the legacy
  // `onchange?.({ target: { value } })` contract consumers depend on.
  function handleValueChange(v) {
    onchange?.({ target: { value: v } });
  }

  function clear(e) {
    e.stopPropagation();
    e.preventDefault();
    value = multiple ? [] : '';
    onchange?.({ target: { value } });
  }
</script>

<div class={cn('flex flex-col gap-1', className)} {...restProps}>
  {#if label}
    <span class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </span>
  {/if}

  <BitsSelect.Root
    type={multiple ? 'multiple' : 'single'}
    bind:value
    bind:open
    items={options}
    {disabled}
    onValueChange={handleValueChange}
  >
    <BitsSelect.Trigger disabled={disabled}>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          class={cn(
            'flex items-center justify-between px-3 h-12 rounded-xs border text-body-lg bg-transparent cursor-pointer text-left gap-2',
            'transition-colors',
            error
              ? 'border-error'
              : open
                ? 'border-primary border-2'
                : 'border-outline hover:border-on-surface',
            disabled && 'opacity-38 pointer-events-none'
          )}
        >
          <span class={cn('truncate flex-1', !hasValue && 'text-on-surface-variant/60')}>
            {displayText || placeholder || 'Select...'}
          </span>

          <span class="flex items-center gap-1 flex-shrink-0">
            {#if hasValue}
              <span
                class="w-5 h-5 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/12 cursor-pointer"
                role="button"
                tabindex="0"
                onpointerdown={(e) => e.stopPropagation()}
                onclick={clear}
                onkeydown={(e) => { if (e.key === 'Enter') clear(e); }}
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </span>
            {/if}
            <svg
              class={cn('w-4 h-4 text-on-surface-variant transition-transform', open && 'rotate-180')}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      {/snippet}
    </BitsSelect.Trigger>

    <BitsSelect.Portal>
      <BitsSelect.Content
        sideOffset={4}
        class="z-50 rounded-sm bg-surface shadow-level-2 border border-outline-variant overflow-hidden py-1 max-h-64 overflow-y-auto"
        style={overlayLayer
          ? `z-index:${overlayLayer.z + 2};width:var(--bits-select-anchor-width);`
          : 'width:var(--bits-select-anchor-width);'}
      >
        <BitsSelect.Viewport>
          {#each options as opt (opt.value)}
            <BitsSelect.Item
              value={opt.value}
              label={opt.label}
              disabled={opt.disabled}
              class={cn(
                'flex items-start w-full px-3 py-2.5 text-body-md cursor-pointer transition-colors text-left',
                multiple && 'gap-3',
                'text-on-surface data-[highlighted]:bg-on-surface/8',
                'data-[selected]:bg-secondary-container data-[selected]:text-on-secondary-container',
                'data-[disabled]:opacity-38 data-[disabled]:pointer-events-none'
              )}
            >
              {#snippet children({ selected })}
                {#if multiple}
                  <span class={cn(
                    'w-5 h-5 rounded-xs border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    selected ? 'bg-primary border-primary' : 'border-outline'
                  )}>
                    {#if selected}
                      <svg class="w-3.5 h-3.5 text-on-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                    {/if}
                  </span>
                {/if}
                <span class="min-w-0 break-words">{opt.label}</span>
              {/snippet}
            </BitsSelect.Item>
          {/each}
        </BitsSelect.Viewport>
      </BitsSelect.Content>
    </BitsSelect.Portal>
  </BitsSelect.Root>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
