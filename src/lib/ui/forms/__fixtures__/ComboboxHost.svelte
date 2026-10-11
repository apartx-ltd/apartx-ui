<script lang="ts">
  // Тестовый хост для combobox.dom.test.ts: itemTrailing-кнопка у сгруппированной опции,
  // freeSolo по пропу, текущее value — в <output>.
  import Combobox from '../Combobox.svelte';
  import type { Option } from '../option-groups';

  let {
    value = $bindable(''),
    freeSolo = false,
    onAction,
    options = [
      { value: 'cash', label: 'Cash' },
      { value: 'card', label: 'Card' },
      { value: 'acme', label: 'ACME', group: 'Custom' },
    ],
  }: { value?: string; freeSolo?: boolean; onAction?: (v: string) => void; options?: Option[] } = $props();
</script>

<Combobox bind:value {options} {freeSolo} label="Account">
  {#snippet itemTrailing(opt)}
    {#if opt.group}
      <button type="button" data-testid={`act-${opt.value}`} onclick={() => onAction?.(opt.value)}>x</button>
    {/if}
  {/snippet}
</Combobox>
<output data-testid="val">{value}</output>
