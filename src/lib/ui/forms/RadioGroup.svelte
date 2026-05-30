<script lang="ts">
  import { RadioGroup as BitsRadioGroup } from 'bits-ui';
  import { cn } from '../utils/cn';

  type Option = { value: string; label?: string; disabled?: boolean };

  /**
   * Radio group (bits-ui) — single choice from a list. M3-styled.
   * `options` is `{ value, label?, disabled? }[]`; bind `value`.
   * All labels are caller props (translate at the call site).
   */
  let {
    value = $bindable(''),
    options = [],
    label = '',
    error = '',
    required = false,
    disabled = false,
    orientation = 'vertical',
    name,
    onValueChange,
    class: className,
    ...restProps
  }: {
    value?: string;
    options?: Option[];
    label?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    orientation?: 'vertical' | 'horizontal';
    name?: string;
    onValueChange?: (v: string) => void;
    class?: string;
    [key: string]: any;
  } = $props();
</script>

<div class={cn('flex flex-col gap-1', className)}>
  {#if label}
    <span class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant')}>
      {label}{required ? ' *' : ''}
    </span>
  {/if}

  <BitsRadioGroup.Root
    bind:value
    {disabled}
    {required}
    {name}
    {orientation}
    {onValueChange}
    class={cn('flex gap-2', orientation === 'horizontal' ? 'flex-row flex-wrap gap-4' : 'flex-col')}
    {...restProps}
  >
    {#each options as opt (opt.value)}
      <label
        class={cn(
          'inline-flex items-center gap-2 cursor-pointer',
          opt.disabled && 'opacity-38 cursor-not-allowed',
        )}
      >
        <BitsRadioGroup.Item
          value={opt.value}
          disabled={opt.disabled}
          class={cn(
            'relative w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            'border-outline data-[state=checked]:border-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
        >
          <span class="w-2.5 h-2.5 rounded-full bg-primary scale-0 transition-transform [[data-state=checked]_&]:scale-100"></span>
        </BitsRadioGroup.Item>
        {#if opt.label}
          <span class="text-body-md text-on-surface">{opt.label}</span>
        {/if}
      </label>
    {/each}
  </BitsRadioGroup.Root>

  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>
