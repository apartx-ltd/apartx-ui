<script lang="ts">
  import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
  import { cn } from '../utils/cn';
  import Button from '../display/Button.svelte';
  import Icon from '../display/Icon.svelte';

  /**
   * Счётчик «− N +» для небольших целых: гости, номера, комнаты.
   * @param value - bindable, целое в [min, max]
   * @param min / max - границы; кнопка на границе гаснет (значение не режется задним числом)
   * @param step - шаг, по умолчанию 1
   * @param disabled - выключает обе кнопки
   * @param decrementLabel / incrementLabel - aria-label кнопок; кит i18n не несёт, потребитель передаёт переведённые подписи
   * @param format - (value) => string для показа (напр. «—» вместо нуля)
   * @param onchange - (value) после каждого изменения
   * restProps — на корневой div (data-testid и т.п.); для доступности группы потребитель
   * передаёт через них `role="group"` + `aria-label`.
   */
  let {
    value = $bindable(0),
    min = 0,
    max = Infinity,
    step = 1,
    disabled = false,
    decrementLabel = '−',
    incrementLabel = '+',
    format = (v: number) => String(v),
    onchange,
    class: className,
    ...restProps
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    decrementLabel?: string;
    incrementLabel?: string;
    format?: (v: number) => string;
    onchange?: (v: number) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  function set(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value) return;
    value = clamped;
    onchange?.(value);
  }
</script>

<div class={cn('inline-flex items-center gap-3', className)} {...restProps}>
  <Button variant="outlined" size="sm" onclick={() => set(value - step)} disabled={disabled || value <= min} aria-label={decrementLabel} data-stepper="dec">
    <Icon icon={faMinus} />
  </Button>
  <!-- aria-live: скринридер должен услышать новое значение после нажатия -->
  <span class="text-on-surface text-title-md min-w-8 text-center font-semibold" data-stepper="value" aria-live="polite">{format(value)}</span>
  <Button variant="outlined" size="sm" onclick={() => set(value + step)} disabled={disabled || value >= max} aria-label={incrementLabel} data-stepper="inc">
    <Icon icon={faPlus} />
  </Button>
</div>
