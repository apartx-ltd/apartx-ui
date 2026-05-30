<script lang="ts">
  import { Combobox as BitsCombobox } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';

  type Option = { value: string; label: string; disabled?: boolean };

  /**
   * Searchable combobox (bits-ui). Filters `options` by the typed query;
   * with `creatable`, an unmatched query can be committed as a new value.
   * Bind `value`. All user text is a prop with an English default.
   */
  let {
    value = $bindable(''),
    options = [],
    label = '',
    placeholder = 'Search…',
    error = '',
    required = false,
    disabled = false,
    creatable = false,
    createLabel = 'Create',
    emptyText = 'No results',
    onValueChange,
    class: className,
    ...restProps
  }: {
    value?: string;
    options?: Option[];
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    creatable?: boolean;
    createLabel?: string;
    emptyText?: string;
    onValueChange?: (v: string) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  let search = $state('');

  let filtered = $derived(
    search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options,
  );

  let exactMatch = $derived(
    options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase()),
  );

  // Show the selected option's label in the input when not actively searching.
  let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');

  function handleInput(e: Event) {
    search = (e.target as HTMLInputElement).value;
  }
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
    {disabled}
    {onValueChange}
    onOpenChange={(o) => { if (!o) search = ''; }}
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
        defaultValue={selectedLabel}
        oninput={handleInput}
        {placeholder}
        class="flex-1 bg-transparent border-none outline-none text-body-lg text-on-surface placeholder:text-on-surface-variant/60 min-w-0"
      />
      <BitsCombobox.Trigger class="flex-shrink-0 text-on-surface-variant cursor-pointer" aria-label="Open">
        <Icon name="chevron-down" />
      </BitsCombobox.Trigger>
    </div>

    <BitsCombobox.Portal>
      <BitsCombobox.Content
        sideOffset={4}
        class="z-50 rounded-sm bg-surface shadow-level-2 border border-outline-variant overflow-hidden py-1 max-h-64"
      >
        <BitsCombobox.Viewport>
          {#each filtered as opt (opt.value)}
            <BitsCombobox.Item
              value={opt.value}
              label={opt.label}
              disabled={opt.disabled}
              class={cn(
                'flex items-center w-full px-3 py-2.5 text-body-md cursor-pointer transition-colors text-left',
                'text-on-surface data-[highlighted]:bg-on-surface/8',
                'data-[selected]:bg-secondary-container data-[selected]:text-on-secondary-container',
                'data-[disabled]:opacity-38 data-[disabled]:pointer-events-none',
              )}
            >
              {opt.label}
            </BitsCombobox.Item>
          {/each}

          {#if creatable && search.trim() && !exactMatch}
            <BitsCombobox.Item
              value={search.trim()}
              label={search.trim()}
              class="flex items-center gap-2 w-full px-3 py-2.5 text-body-md cursor-pointer text-primary data-[highlighted]:bg-on-surface/8"
            >
              <Icon name="plus" />
              {createLabel} “{search.trim()}”
            </BitsCombobox.Item>
          {/if}

          {#if filtered.length === 0 && !(creatable && search.trim())}
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
