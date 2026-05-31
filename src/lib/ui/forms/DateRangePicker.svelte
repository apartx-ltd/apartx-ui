<script lang="ts">
  import { DateRangePicker as BitsRange } from 'bits-ui';
  import { parseDate, type DateValue } from '@internationalized/date';
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import { faCalendar, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

  type RangeStr = { start: string; end: string };
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };

  let {
    value = $bindable({ start: '', end: '' }),
    label = '',
    disabled = false,
    required = false,
    error = '',
    minValue,
    maxValue,
    numberOfMonths = 2,
    class: className,
  }: {
    value?: RangeStr;
    label?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    minValue?: string;
    maxValue?: string;
    numberOfMonths?: number;
    class?: string;
  } = $props();

  function safeParse(v: string | undefined): DateValue | undefined {
    if (!v) return undefined;
    try { return parseDate(v); } catch { return undefined; }
  }

  let range = $state<DateRange>({ start: safeParse(value.start), end: safeParse(value.end) });

  $effect(() => {
    const next = { start: range.start ? range.start.toString() : '', end: range.end ? range.end.toString() : '' };
    if (next.start !== value.start || next.end !== value.end) value = next;
  });

  $effect(() => {
    const cur = { start: range.start ? range.start.toString() : '', end: range.end ? range.end.toString() : '' };
    if (cur.start !== value.start || cur.end !== value.end) {
      range = { start: safeParse(value.start), end: safeParse(value.end) };
    }
  });

  let minDV = $derived(safeParse(minValue));
  let maxDV = $derived(safeParse(maxValue));
</script>

<div class={cn('flex flex-col gap-1', className)}>
  <BitsRange.Root
    bind:value={range}
    {disabled}
    {numberOfMonths}
    minValue={minDV}
    maxValue={maxDV}
  >
    {#if label}
      <BitsRange.Label class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
        {label}{required ? ' *' : ''}
      </BitsRange.Label>
    {/if}

    <div
      class={cn(
        'flex items-center gap-2 px-3 h-12 rounded-xs border bg-transparent transition-colors',
        error
          ? 'border-error'
          : 'border-outline focus-within:border-primary focus-within:border-2 hover:border-on-surface',
        disabled && 'opacity-38 pointer-events-none',
      )}
    >
      {#each ['start', 'end'] as const as type, idx (type)}
        <BitsRange.Input {type}>
          {#snippet children({ segments })}
            <div class="flex items-center gap-0.5">
              {#each segments as { part, value: segValue }, i (i)}
                {#if part === 'literal'}
                  <span class="text-body-lg text-on-surface-variant select-none">{segValue}</span>
                {:else}
                  <BitsRange.Segment
                    {part}
                    class="px-1 py-0.5 text-body-lg text-on-surface rounded-xs focus:outline-none focus:bg-primary/12 data-[placeholder]:text-on-surface-variant/60"
                  >
                    {segValue}
                  </BitsRange.Segment>
                {/if}
              {/each}
            </div>
          {/snippet}
        </BitsRange.Input>
        {#if idx === 0}
          <span class="text-on-surface-variant select-none">–</span>
        {/if}
      {/each}

      <BitsRange.Trigger
        class="ml-auto p-1 rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer focus-visible:outline-none focus-visible:bg-on-surface/8"
        aria-label="Open calendar"
      >
        <Icon icon={faCalendar} />
      </BitsRange.Trigger>
    </div>

    <BitsRange.Content sideOffset={4} class="z-50 outline-none">
      <div class="bg-surface shadow-level-3 rounded-md p-3 border border-outline-variant">
        <BitsRange.Calendar>
          {#snippet children({ months, weekdays })}
            <BitsRange.Header class="flex items-center justify-between mb-2">
              <BitsRange.PrevButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
                <Icon icon={faChevronLeft} />
              </BitsRange.PrevButton>
              <BitsRange.Heading class="text-title-sm text-on-surface" />
              <BitsRange.NextButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
                <Icon icon={faChevronRight} />
              </BitsRange.NextButton>
            </BitsRange.Header>

            <div class="flex gap-4">
              {#each months as month, i (i)}
                <BitsRange.Grid class="border-collapse">
                  <BitsRange.GridHead>
                    <BitsRange.GridRow class="flex">
                      {#each weekdays as day, j (j)}
                        <BitsRange.HeadCell class="w-9 h-9 flex items-center justify-center text-label-sm text-on-surface-variant font-medium">
                          {day.slice(0, 2)}
                        </BitsRange.HeadCell>
                      {/each}
                    </BitsRange.GridRow>
                  </BitsRange.GridHead>
                  <BitsRange.GridBody>
                    {#each month.weeks as weekDates, w (w)}
                      <BitsRange.GridRow class="flex">
                        {#each weekDates as date (date.toString())}
                          <BitsRange.Cell {date} month={month.value} class="p-0">
                            <BitsRange.Day
                              class={cn(
                                'w-9 h-9 flex items-center justify-center text-body-md rounded-full cursor-pointer text-on-surface',
                                'hover:bg-on-surface/8 focus:outline-none focus:bg-on-surface/8',
                                'data-[selected]:bg-secondary-container data-[selected]:text-on-secondary-container data-[selected]:rounded-none',
                                'data-[selection-start]:bg-primary data-[selection-start]:text-on-primary data-[selection-start]:rounded-l-full',
                                'data-[selection-end]:bg-primary data-[selection-end]:text-on-primary data-[selection-end]:rounded-r-full',
                                'data-[outside-month]:text-on-surface-variant/40 data-[outside-month]:pointer-events-none',
                                'data-[disabled]:opacity-38 data-[disabled]:pointer-events-none',
                                'data-[unavailable]:line-through data-[unavailable]:text-on-surface-variant/40',
                              )}
                            >
                              {date.day}
                            </BitsRange.Day>
                          </BitsRange.Cell>
                        {/each}
                      </BitsRange.GridRow>
                    {/each}
                  </BitsRange.GridBody>
                </BitsRange.Grid>
              {/each}
            </div>
          {/snippet}
        </BitsRange.Calendar>
      </div>
    </BitsRange.Content>
  </BitsRange.Root>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
