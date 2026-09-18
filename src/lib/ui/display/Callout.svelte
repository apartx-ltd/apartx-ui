<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import Text from './Text.svelte';

  /**
   * Плашка «нужно действие» на странице: заголовок, пояснение и кнопки на тональной
   * заливке. Заменяет повторявшуюся у консьюмеров связку
   * `<Card class="bg-primary-container text-on-primary-container flex flex-col gap-2 p-4">`
   * + `<h3 class="text-title-md">` + `<p class="text-body-md">` + `<Button>`.
   *
   * Тон — пара M3-токенов container/on-container, поэтому текст и иконка всегда
   * контрастны заливке и следуют теме бренда. Кнопки в `actions` кладутся столбцом
   * во всю ширину (мобильный баннер); текст внутри наследует цвет тона.
   *
   * @example
   * <Callout icon={faIdCard} title="Self check-in">
   *   Verify your identity before arrival.
   *   {#snippet actions()}<Button variant="filled">Start check-in</Button>{/snippet}
   * </Callout>
   * <Callout tone="error" title="Cancelled" />
   */
  type CalloutTone = 'primary' | 'secondary' | 'tertiary' | 'error';

  let {
    tone = 'primary',
    icon,
    title,
    children,
    actions,
    class: className,
    ...restProps
  }: {
    tone?: CalloutTone;
    icon?: IconDefinition;
    // Строка или сниппет — когда в заголовке разметка (счётчик, ссылка).
    title?: string | Snippet;
    children?: Snippet;
    actions?: Snippet;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const TONE_CLASS: Record<CalloutTone, string> = {
    primary: 'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
    error: 'bg-error-container text-on-error-container',
  };
  // Неизвестный тон откатывается на дефолт, а не оставляет плашку без заливки.
  const toneClass = $derived(TONE_CLASS[tone] ?? TONE_CLASS.primary);
</script>

<div class={cn('flex flex-col gap-2 rounded-md p-4', toneClass, className)} data-tone={tone} {...restProps}>
  {#if icon || title}
    <div class="flex items-center gap-2">
      {#if icon}<Icon {icon} size="lg" class="shrink-0" />{/if}
      {#if title}
        <Text role="group-title" tone="inherit" as="h3" class="min-w-0 flex-1">
          {#if typeof title === 'function'}{@render title()}{:else}{title}{/if}
        </Text>
      {/if}
    </div>
  {/if}
  {#if children}
    <Text role="hint" tone="inherit" as="div">{@render children()}</Text>
  {/if}
  {#if actions}
    <div class="flex flex-col gap-2">{@render actions()}</div>
  {/if}
</div>
