<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils/cn';
  import { ROLE_TAG, TONE_CLASS, type TextRole, type TextTone } from '../utils/typography';

  /**
   * Ролевая типографика: вместо ручной пары `text-body-md text-on-surface-variant`
   * на месте вызова — одна роль. Тег роли перебивается пропом `as`.
   *
   * @example
   * <Text role="page-title">Бронирования</Text>
   * <Text role="hint" tone="error">Дата занята</Text>
   * <Text role="section-title" as="h3">Гости</Text>
   */

  // role обязателен намеренно: доминирующей роли в данных нет, молчаливый
  // дефолт маскировал бы забытый выбор. Дефолтный тон зашит в алиас text-<role>;
  // проп tone перебивает его классом из @layer utilities (слой сильнее components).
  let {
    role,
    tone,
    as,
    class: className,
    children,
    ...restProps
  }: {
    role: TextRole;
    tone?: TextTone;
    as?: string;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const tag = $derived(as ?? ROLE_TAG[role]);
  const cls = $derived(cn(`text-${role}`, tone && TONE_CLASS[tone], className));
</script>

<svelte:element this={tag} class={cls} {...restProps}>{@render children?.()}</svelte:element>
