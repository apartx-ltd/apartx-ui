<script lang="ts">
  // Тестовый хост для select.dom.test.ts «группы и действия»: itemTrailing у сгруппированной опции.
  import Select from '../Select.svelte';
  import type { Option } from '../option-groups';

  let {
    value = $bindable(''),
    open = $bindable(false),
    onAction,
  }: { value?: string; open?: boolean; onAction?: (v: string) => void } = $props();

  const options: Option[] = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'svc1', label: 'Late checkout', group: 'Saved services' },
    { value: 'other', label: 'Other…' },
  ];
</script>

<Select bind:value bind:open {options} label="Type" data-testid="sel">
  {#snippet item(opt)}
    <span data-testid={`row-${opt.value}`}>{opt.label}</span>
  {/snippet}
  {#snippet itemTrailing(opt)}
    {#if opt.group}
      <button type="button" data-testid={`act-${opt.value}`} onclick={() => onAction?.(opt.value)}>x</button>
    {/if}
  {/snippet}
</Select>
<output data-testid="val">{value}</output>
<output data-testid="open">{String(open)}</output>
