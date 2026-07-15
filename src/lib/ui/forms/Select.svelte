<script>
  import { cn } from '../utils/cn';
  import { getOverlayLayer } from '../overlays/layer-context';
  import { useOverlay } from '../../hooks/useOverlay.svelte';

  // Move a node to <body> so it escapes clipping/stacking ancestors.
  function portal(node) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  // The dropdown is portalled to <body> so it escapes any clipping ancestor —
  // a kit <Dialog> panel is `overflow-hidden` and its body `overflow-y-auto`, so
  // an in-flow `absolute` dropdown was cut off (unreachable options). Mirrors the
  // Combobox/DateRangePicker direction. Positioned `fixed`, anchored to the trigger
  // rect, repositioned on scroll/resize while open. z-index: inside a stacked overlay
  // (modal registry injects a layer) sit at `layer.z + 2`; otherwise `60` — above a
  // standalone Dialog's `z-50` content. No layer ⇒ backwards-compatible.
  const overlayLayer = getOverlayLayer();
  const menuZ = $derived(overlayLayer ? overlayLayer.z + 2 : 60);

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
  let triggerEl = $state();
  let pos = $state({ top: 0, left: 0, width: 0 });

  function reposition() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    pos = { top: r.bottom + 4, left: r.left, width: r.width };
  }

  // Keep the portalled menu glued to the trigger while it is open.
  $effect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  });

  let displayText = $derived(() => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return '';
      if (arr.length <= 2) return arr.map(v => options.find(o => o.value === v)?.label ?? v).join(', ');
      return `${arr.length} selected`;
    }
    return options.find(o => o.value === value)?.label ?? '';
  });

  let hasValue = $derived(multiple ? Array.isArray(value) && value.length > 0 : !!value);

  function toggle() {
    if (disabled) return;
    if (!open) reposition();
    open = !open;
  }

  function select(opt) {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      const idx = arr.indexOf(opt.value);
      value = idx >= 0 ? arr.filter(v => v !== opt.value) : [...arr, opt.value];
    } else {
      value = opt.value;
      open = false;
    }
    onchange?.({ target: { value } });
  }

  function clear(e) {
    e.stopPropagation();
    value = multiple ? [] : '';
    onchange?.({ target: { value } });
  }

  function isSelected(optValue) {
    if (multiple) return Array.isArray(value) && value.includes(optValue);
    return value === optValue;
  }
</script>

<div class={cn('flex flex-col gap-1 relative', className)} {...restProps}>
  {#if label}
    <span class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </span>
  {/if}

  <button
    bind:this={triggerEl}
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
    {disabled}
    onclick={toggle}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
  >
    <span class={cn('truncate flex-1', !hasValue && 'text-on-surface-variant/60')}>
      {displayText() || placeholder || 'Select...'}
    </span>

    <span class="flex items-center gap-1 flex-shrink-0">
      {#if hasValue}
        <span
          class="w-5 h-5 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/12 cursor-pointer"
          role="button"
          tabindex="0"
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

  {#if open}
    <div use:portal>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- pointer-events-auto: a portalled body-descendant inherits body {pointer-events:none}
         set by an open bits-ui Dialog, so re-enable it here (mirrors the Dialog's own content). -->
    <div class="fixed inset-0 pointer-events-auto" style={`z-index:${menuZ - 1};`} onclick={() => { open = false; }} onkeydown={(e) => { if (e.key === 'Escape') open = false; }}></div>

    <div
      class="fixed pointer-events-auto rounded-sm bg-surface shadow-level-2 border border-outline-variant overflow-hidden py-1 max-h-64 overflow-y-auto"
      style={`top:${pos.top}px;left:${pos.left}px;width:${pos.width}px;z-index:${menuZ};`}
      role="listbox"
      aria-multiselectable={multiple || undefined}
    >
      {#each options as opt (opt.value)}
        <button
          type="button"
          role="option"
          aria-selected={isSelected(opt.value)}
          class={cn(
            'flex items-start w-full px-3 py-2.5 text-body-md cursor-pointer transition-colors text-left',
            multiple && 'gap-3',
            isSelected(opt.value)
              ? 'bg-secondary-container text-on-secondary-container'
              : 'text-on-surface hover:bg-on-surface/8'
          )}
          onclick={() => select(opt)}
        >
          {#if multiple}
            <span class={cn(
              'w-5 h-5 rounded-xs border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isSelected(opt.value) ? 'bg-primary border-primary' : 'border-outline'
            )}>
              {#if isSelected(opt.value)}
                <svg class="w-3.5 h-3.5 text-on-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              {/if}
            </span>
          {/if}
          <span class="min-w-0 break-words">{opt.label}</span>
        </button>
      {/each}
    </div>
    </div>
  {/if}

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
