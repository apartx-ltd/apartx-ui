<script lang="ts" generics="T extends Option">
  import { untrack, type Snippet } from 'svelte';
  import { Combobox as BitsCombobox } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import { faChevronDown, faPlus } from '@fortawesome/free-solid-svg-icons';
  import { getOverlayLayer } from '../overlays/layer-context';
  import { useOverlay } from '../../hooks/useOverlay.svelte';
  import { groupOptions, type Option } from './option-groups';

  // The dropdown portals to <body> at z-50 by default — fine standalone, but when
  // this combobox lives inside a layered overlay (modal registry's <Dialog>, which
  // renders at `layer.z + 1`), z-50 falls *behind* the dialog and the options become
  // unclickable. Read the same overlay layer the Dialog uses and render the popup at
  // `layer.z + 2` (above the dialog content, below any deeper modal). No layer ⇒
  // keep the z-50 class (fully backwards-compatible). Mirrors Dialog/BottomSheet.
  const overlayLayer = getOverlayLayer();

  /**
   * Searchable combobox (bits-ui). Filters `options` by the typed query;
   * with `creatable`, an unmatched query can be committed as a new value;
   * with `freeSolo`, the typed text IS the value (committed on every keystroke).
   * Серии соседних опций с одинаковым `group` — под заголовком; `item` рисует
   * содержимое строки, `itemTrailing` — действия справа (кит гасит их события,
   * клик по кнопке не выбирает строку и не уводит фокус из input). Действия
   * `itemTrailing` — только для указателя: они живут внутри `role=option` и в
   * порядок табуляции не входят, клавиатурного пути к ним нет. Bind `value`/`open`. All user text is a
   * prop with an English default.
   */
  let {
    value = $bindable(''),
    open = $bindable(false),
    options = [],
    label = '',
    placeholder = 'Search…',
    error = '',
    required = false,
    disabled = false,
    creatable = false,
    freeSolo = false,
    createLabel = 'Create',
    emptyText = 'No results',
    respectBack = true,
    onValueChange,
    onOpenChange,
    item,
    itemTrailing,
    class: className,
    ...restProps
  }: {
    value?: string;
    open?: boolean;
    options?: T[];
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    creatable?: boolean;
    freeSolo?: boolean;
    createLabel?: string;
    emptyText?: string;
    respectBack?: boolean;
    onValueChange?: (v: string) => void;
    onOpenChange?: (open: boolean) => void;
    item?: Snippet<[T, { selected: boolean; highlighted: boolean }]>;
    itemTrailing?: Snippet<[T]>;
    class?: string;
    [key: string]: any;
  } = $props();

  let search = $state('');
  // freeSolo: при открытии в input остаётся сохранённый текст (его можно править), но
  // список фильтруется только после первого ввода — до того он показан целиком.
  let dirty = $state(false);
  // freeSolo: пользователь ходил по списку стрелками с момента открытия — Enter выбирает строку.
  let navigated = false;

  useOverlay(() => open, () => { open = false; }, { respectBack });

  let query = $derived(freeSolo && !dirty ? '' : search);
  let filtered = $derived(
    query
      ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : options,
  );
  let groups = $derived(groupOptions(filtered));

  let exactMatch = $derived(
    options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase()),
  );
  // Строка «создать»: creatable — по клику, freeSolo — текст уже в value, строка лишь
  // закрывает меню тем же путём, что выбор опции.
  let showCreateRow = $derived((creatable || freeSolo) && !!query.trim() && !exactMatch);

  // Show the selected option's label in the input when not actively searching.
  // `defaultValue` on BitsCombobox.Input is non-reactive (set once at mount), so a
  // value/options pair that resolves *after* mount (async fetch, edit-form seeding)
  // would never display. Drive the input via the Root's reactive `inputValue` box
  // instead: while the popup is open the user is searching → show their query; when
  // closed → show the selected option's label (reactively, even if it arrives late).
  // freeSolo: значение вне списка показываем как есть.
  let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? (freeSolo ? value : ''));
  let displayValue = $derived(open ? search : selectedLabel);

  function handleInput(e: Event) {
    search = (e.target as HTMLInputElement).value;
    dirty = true;
    if (!freeSolo) return;
    // Текст, совпавший с label опции, — выбор этой опции: коммитим её value, не сырой текст.
    const match = options.find((o) => o.label.toLowerCase() === search.trim().toLowerCase());
    const next = match ? match.value : search;
    value = next;
    onValueChange?.(next);
  }

  // open меняют и снаружи (bind:open), а bits зовёт onOpenChange только за свои изменения —
  // засев query делаем по фронту false→true самого open. pre — до отрисовки, чтобы input
  // не мигнул прежним поиском.
  let wasOpen = false;
  $effect.pre(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      untrack(() => {
        dirty = false;
        navigated = false;
        search = freeSolo ? selectedLabel : '';
      });
    }
    wasOpen = isOpen;
  });

  // freeSolo, MUI-семантика: Enter фиксирует текст в input. bits при открытии подсвечивает
  // первую опцию, и Enter без ввода подменил бы сохранённое значение (вне списка) ею.
  // Пока пользователь не печатал и не ходил стрелками, Enter просто закрывает меню.
  // Наш обработчик идёт в mergeProps первым; preventDefault не даёт bits выбрать строку.
  const NAV_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'];
  function handleKeydown(e: KeyboardEvent) {
    if (!freeSolo || !open) return;
    if (NAV_KEYS.includes(e.key)) navigated = true;
    if (e.key !== 'Enter' || e.isComposing) return;
    if (dirty || navigated || !value || options.some((o) => o.value === value)) return;
    e.preventDefault();
    open = false;
  }

  // itemTrailing: кнопка внутри bits Item — без этого bits выбирает строку по pointerup/click.
  // pointerdown ещё и не даёт фокусу уйти из input, иначе клавиатурная навигация пропадает.
  const stop = (e: Event) => e.stopPropagation();
  const keepFocus = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
</script>

<div class={cn('flex flex-col gap-1', className)}>
  {#if label}
    <span class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </span>
  {/if}

  <BitsCombobox.Root
    type="single"
    bind:value
    bind:open
    {disabled}
    {onValueChange}
    allowDeselect={!freeSolo}
    inputValue={displayValue}
    {onOpenChange}
    {...restProps}
  >
    <div
      class={cn(
        'flex items-center gap-2 px-3 h-12 rounded-xs border bg-transparent transition-colors',
        error
          ? 'border-error'
          : 'border-outline focus-within:border-primary focus-within:border-2 hover:border-on-surface',
        disabled && 'opacity-38 pointer-events-none',
      )}
    >
      <BitsCombobox.Input
        oninput={handleInput}
        onkeydown={handleKeydown}
        {placeholder}
        class="flex-1 bg-transparent border-none outline-none text-body-lg text-on-surface placeholder:text-on-surface-variant/60 min-w-0"
      />
      <BitsCombobox.Trigger class="flex-shrink-0 text-on-surface-variant cursor-pointer" aria-label="Open">
        <Icon icon={faChevronDown} class={cn('transition-transform', open && 'rotate-180')} />
      </BitsCombobox.Trigger>
    </div>

    <BitsCombobox.Portal>
      <BitsCombobox.Content
        sideOffset={4}
        class="z-50 rounded-sm bg-surface shadow-level-2 border border-outline-variant overflow-hidden py-1 max-h-64"
        style={overlayLayer ? `z-index:${overlayLayer.z + 2};` : ''}
      >
        <BitsCombobox.Viewport>
          {#each groups as g, gi (gi)}
            <BitsCombobox.Group class={cn(gi > 0 && 'mt-1 border-t border-outline-variant pt-1')}>
              {#if g.label}
                <BitsCombobox.GroupHeading class="px-3 py-1.5 text-label-sm text-on-surface-variant/70">
                  {g.label}
                </BitsCombobox.GroupHeading>
              {/if}
              {#each g.options as opt (opt.value)}
                <BitsCombobox.Item
                  value={opt.value}
                  label={opt.label}
                  disabled={opt.disabled}
                  class={cn(
                    'flex items-center gap-2 w-full px-3 py-2.5 text-body-md cursor-pointer transition-colors text-left',
                    'text-on-surface data-[highlighted]:bg-on-surface/8',
                    'data-[selected]:bg-secondary-container data-[selected]:text-on-secondary-container',
                    'data-[disabled]:opacity-38 data-[disabled]:pointer-events-none',
                  )}
                >
                  {#snippet children({ selected, highlighted })}
                    <span class={cn('min-w-0 flex-1', itemTrailing && 'truncate')}>
                      {#if item}{@render item(opt, { selected, highlighted })}{:else}{opt.label}{/if}
                    </span>
                    {#if itemTrailing}
                      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                      <span class="flex flex-shrink-0 items-center gap-1" onpointerdown={keepFocus} onpointerup={stop} onclick={stop}>
                        {@render itemTrailing(opt)}
                      </span>
                    {/if}
                  {/snippet}
                </BitsCombobox.Item>
              {/each}
            </BitsCombobox.Group>
          {/each}

          {#if showCreateRow}
            <BitsCombobox.Item
              value={query.trim()}
              label={query.trim()}
              class="flex items-center gap-2 w-full px-3 py-2.5 text-body-md cursor-pointer text-primary data-[highlighted]:bg-on-surface/8"
            >
              <Icon icon={faPlus} />
              {#if creatable}{createLabel} “{query.trim()}”{:else}{query.trim()}{/if}
            </BitsCombobox.Item>
          {/if}

          {#if filtered.length === 0 && !showCreateRow}
            <div class="px-3 py-2.5 text-body-md text-on-surface-variant">{emptyText}</div>
          {/if}
        </BitsCombobox.Viewport>
      </BitsCombobox.Content>
    </BitsCombobox.Portal>
  </BitsCombobox.Root>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
