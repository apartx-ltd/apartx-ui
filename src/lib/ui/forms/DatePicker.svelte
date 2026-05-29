<script lang="ts">
  import { DatePicker as BitsDatePicker } from 'bits-ui';
  import { parseDate, type DateValue } from '@internationalized/date';
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';

  let {
    value = $bindable(''),
    label = '',
    placeholder = '',
    disabled = false,
    required = false,
    error = '',
    minValue,
    maxValue,
    class: className,
  }: {
    value?: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    minValue?: string;
    maxValue?: string;
    class?: string;
  } = $props();

  function safeParse(v: string | undefined): DateValue | undefined {
    if (!v) return undefined;
    try { return parseDate(v); } catch { return undefined; }
  }

  let dateValue = $state<DateValue | undefined>(safeParse(value));

  $effect(() => {
    const next = dateValue ? dateValue.toString() : '';
    if (next !== value) value = next;
  });

  $effect(() => {
    const cur = dateValue ? dateValue.toString() : '';
    if (cur !== value) dateValue = safeParse(value);
  });

  let minDV = $derived(safeParse(minValue));
  let maxDV = $derived(safeParse(maxValue));
</script>

<div class={cn('flex flex-col gap-1', className)}>
  <BitsDatePicker.Root
    bind:value={dateValue}
    {disabled}
    minValue={minDV}
    maxValue={maxDV}
  >
    {#if label}
      <BitsDatePicker.Label class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
        {label}{required ? ' *' : ''}
      </BitsDatePicker.Label>
    {/if}

    <BitsDatePicker.Input>
      {#snippet children({ segments })}
        <div
          class={cn(
            'flex items-center gap-1 px-3 h-12 rounded-xs border bg-transparent transition-colors',
            error
              ? 'border-error'
              : 'border-outline focus-within:border-primary focus-within:border-2 hover:border-on-surface',
            disabled && 'opacity-38 pointer-events-none',
          )}
        >
          {#each segments as { part, value: segValue }, i (i)}
            {#if part === 'literal'}
              <span class="text-body-lg text-on-surface-variant select-none">{segValue}</span>
            {:else}
              <BitsDatePicker.Segment
                {part}
                class="px-1 py-0.5 text-body-lg text-on-surface rounded-xs focus:outline-none focus:bg-primary/12 data-[placeholder]:text-on-surface-variant/60"
              >
                {segValue}
              </BitsDatePicker.Segment>
            {/if}
          {/each}
          <BitsDatePicker.Trigger
            class="ml-auto p-1 rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer focus-visible:outline-none focus-visible:bg-on-surface/8"
            aria-label="Open calendar"
          >
            <Icon name="calendar" />
          </BitsDatePicker.Trigger>
        </div>
      {/snippet}
    </BitsDatePicker.Input>

    <BitsDatePicker.Portal>
    <BitsDatePicker.Content sideOffset={4} class="z-50 outline-none">
      <div class="bg-surface shadow-level-3 rounded-md p-3 border border-outline-variant">
        <BitsDatePicker.Calendar>
          {#snippet children({ months, weekdays })}
            <BitsDatePicker.Header class="flex items-center justify-between mb-2">
              <BitsDatePicker.PrevButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
                <Icon name="chevron-left" />
              </BitsDatePicker.PrevButton>
              <BitsDatePicker.Heading class="text-title-sm text-on-surface" />
              <BitsDatePicker.NextButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
                <Icon name="chevron-right" />
              </BitsDatePicker.NextButton>
            </BitsDatePicker.Header>

            {#each months as month, i (i)}
              <BitsDatePicker.Grid class="border-collapse">
                <BitsDatePicker.GridHead>
                  <BitsDatePicker.GridRow class="flex">
                    {#each weekdays as day, j (j)}
                      <BitsDatePicker.HeadCell class="w-9 h-9 flex items-center justify-center text-label-sm text-on-surface-variant font-medium">
                        {day.slice(0, 2)}
                      </BitsDatePicker.HeadCell>
                    {/each}
                  </BitsDatePicker.GridRow>
                </BitsDatePicker.GridHead>
                <BitsDatePicker.GridBody>
                  {#each month.weeks as weekDates, w (w)}
                    <BitsDatePicker.GridRow class="flex">
                      {#each weekDates as date (date.toString())}
                        <BitsDatePicker.Cell {date} month={month.value} class="p-0">
                          <BitsDatePicker.Day
                            class={cn(
                              'w-9 h-9 flex items-center justify-center text-body-md rounded-full cursor-pointer text-on-surface',
                              'hover:bg-on-surface/8 focus:outline-none focus:bg-on-surface/8',
                              'data-[selected]:bg-primary data-[selected]:text-on-primary data-[selected]:hover:bg-primary',
                              'data-[outside-month]:text-on-surface-variant/40 data-[outside-month]:pointer-events-none',
                              'data-[disabled]:opacity-38 data-[disabled]:pointer-events-none',
                              'data-[unavailable]:line-through data-[unavailable]:text-on-surface-variant/40',
                            )}
                          >
                            {date.day}
                          </BitsDatePicker.Day>
                        </BitsDatePicker.Cell>
                      {/each}
                    </BitsDatePicker.GridRow>
                  {/each}
                </BitsDatePicker.GridBody>
              </BitsDatePicker.Grid>
            {/each}
          {/snippet}
        </BitsDatePicker.Calendar>
      </div>
    </BitsDatePicker.Content>
    </BitsDatePicker.Portal>
  </BitsDatePicker.Root>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
