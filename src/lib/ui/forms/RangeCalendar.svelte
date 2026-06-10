<script lang="ts">
  import { RangeCalendar as BitsRangeCalendar } from 'bits-ui';
  import { parseDate, type DateValue } from '@internationalized/date';
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

  // Always-visible (inline) range calendar — same grid/day styling as
  // DateRangePicker's popover calendar, but without the field/trigger. Use it
  // inside a modal/sheet where the calendar should be shown directly.

  type RangeStr = { start: string; end: string };
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };

  let {
    value = $bindable({ start: '', end: '' }),
    minValue,
    maxValue,
    numberOfMonths = 1,
    class: className,
  }: {
    value?: RangeStr;
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

<BitsRangeCalendar.Root
  bind:value={range}
  {numberOfMonths}
  minValue={minDV}
  maxValue={maxDV}
  class={cn('w-full', className)}
>
  {#snippet children({ months, weekdays })}
    <BitsRangeCalendar.Header class="flex items-center justify-between mb-2">
      <BitsRangeCalendar.PrevButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
        <Icon icon={faChevronLeft} />
      </BitsRangeCalendar.PrevButton>
      <BitsRangeCalendar.Heading class="text-title-sm text-on-surface" />
      <BitsRangeCalendar.NextButton class="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 cursor-pointer">
        <Icon icon={faChevronRight} />
      </BitsRangeCalendar.NextButton>
    </BitsRangeCalendar.Header>

    <div class="flex flex-wrap justify-center gap-4">
      {#each months as month, i (i)}
        <BitsRangeCalendar.Grid class="border-collapse">
          <BitsRangeCalendar.GridHead>
            <BitsRangeCalendar.GridRow class="flex">
              {#each weekdays as day, j (j)}
                <BitsRangeCalendar.HeadCell class="w-9 h-9 flex items-center justify-center text-label-sm text-on-surface-variant font-medium">
                  {day.slice(0, 2)}
                </BitsRangeCalendar.HeadCell>
              {/each}
            </BitsRangeCalendar.GridRow>
          </BitsRangeCalendar.GridHead>
          <BitsRangeCalendar.GridBody>
            {#each month.weeks as weekDates, w (w)}
              <BitsRangeCalendar.GridRow class="flex">
                {#each weekDates as date (date.toString())}
                  <BitsRangeCalendar.Cell {date} month={month.value} class="p-0">
                    <BitsRangeCalendar.Day
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
                    </BitsRangeCalendar.Day>
                  </BitsRangeCalendar.Cell>
                {/each}
              </BitsRangeCalendar.GridRow>
            {/each}
          </BitsRangeCalendar.GridBody>
        </BitsRangeCalendar.Grid>
      {/each}
    </div>
  {/snippet}
</BitsRangeCalendar.Root>
