<script lang="ts">
  import { cn } from '../utils/cn';
  import { faArrowLeft, faRotateLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
  import Icon from '../display/Icon.svelte';
  import { DEFAULT_COLOR_PALETTE, normalizeHex } from './color-picker';

  /**
   * Inline color palette: a grid of swatches, a switch to a free color (native picker + HEX
   * field) and a reset to the default. Value is `#rrggbb` or `null` ("default" — `defaultValue`
   * is shown as selected). The kit has no i18n: texts come in `labels`.
   */
  let {
    value = $bindable(null),
    defaultValue,
    palette = DEFAULT_COLOR_PALETTE,
    disabled = false,
    labels = {},
    onChange,
    class: className,
  }: {
    value?: string | null;
    defaultValue: string;
    palette?: readonly string[];
    disabled?: boolean;
    labels?: { custom?: string; backToPalette?: string; reset?: string; hex?: string };
    onChange?: (value: string | null) => void;
    class?: string;
  } = $props();

  let mode = $state<'palette' | 'custom'>('palette');
  let draft = $state('');
  let invalid = $state(false);

  const defaultHex = $derived(normalizeHex(defaultValue) ?? defaultValue);
  const valueHex = $derived(value ? normalizeHex(value) : null);
  const current = $derived(valueHex ?? defaultHex);
  const canReset = $derived(valueHex !== null && valueHex !== defaultHex);

  function commit(next: string | null) {
    if (next === value) return;
    value = next;
    onChange?.(next);
  }

  function pick(hex: string) {
    if (hex === current) return;
    commit(hex);
  }

  function openCustom() {
    draft = current;
    invalid = false;
    mode = 'custom';
  }

  function applyDraft() {
    const hex = normalizeHex(draft);
    if (!hex) {
      invalid = true;
      return;
    }
    invalid = false;
    draft = hex;
    if (hex !== current) commit(hex);
  }

  function onNativeChange(e: Event) {
    draft = (e.currentTarget as HTMLInputElement).value;
    applyDraft();
  }

  function onHexKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    applyDraft();
  }

  const actionClass =
    'inline-flex items-center gap-2 h-8 px-2 rounded-xs text-label-md text-on-surface-variant hover:bg-on-surface/8 cursor-pointer focus-visible:outline-none focus-visible:bg-on-surface/8 disabled:opacity-38 disabled:pointer-events-none';
</script>

<div data-color-palette class={cn('flex flex-col gap-2', className)}>
  {#if mode === 'palette'}
    <div class="grid grid-cols-8 gap-1.5">
      {#each palette as hex (hex)}
        <button
          type="button"
          data-swatch={hex}
          aria-label={hex}
          aria-pressed={hex === current ? 'true' : undefined}
          {disabled}
          style="background:{hex}"
          class={cn(
            'h-6 w-6 rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-38 disabled:pointer-events-none',
            hex === current && 'outline-2 outline-offset-2 outline-on-surface',
          )}
          onclick={() => pick(hex)}
        ></button>
      {/each}
    </div>
    <button type="button" data-color-custom class={actionClass} {disabled} onclick={openCustom}>
      <Icon icon={faPlus} />{labels.custom ?? 'Custom color…'}
    </button>
  {:else}
    <div class="flex items-center gap-2">
      <input
        type="color"
        data-color-input
        value={normalizeHex(draft) ?? current}
        {disabled}
        class="h-10 w-10 shrink-0 cursor-pointer rounded-xs border border-outline bg-transparent p-0.5"
        onchange={onNativeChange}
      />
      <input
        type="text"
        data-color-hex
        aria-label={labels.hex ?? 'HEX'}
        placeholder={labels.hex ?? 'HEX'}
        maxlength="7"
        {disabled}
        bind:value={draft}
        aria-invalid={invalid ? 'true' : undefined}
        class={cn(
          'h-10 w-28 rounded-xs border bg-transparent px-3 text-body-md font-mono focus:outline-none',
          invalid
            ? 'border-error text-error'
            : 'border-outline text-on-surface focus:border-primary focus:border-2',
        )}
        oninput={() => (invalid = false)}
        onkeydown={onHexKey}
        onblur={() => draft && applyDraft()}
      />
    </div>
    <button type="button" data-color-back class={actionClass} {disabled} onclick={() => (mode = 'palette')}>
      <Icon icon={faArrowLeft} />{labels.backToPalette ?? 'Back to palette'}
    </button>
  {/if}
  {#if canReset}
    <button
      type="button"
      data-color-reset
      class={actionClass}
      {disabled}
      onclick={() => {
        invalid = false;
        commit(null);
      }}
    >
      <Icon icon={faRotateLeft} />{labels.reset ?? 'Reset to default'}
    </button>
  {/if}
</div>
