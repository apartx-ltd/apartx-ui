/*
 * Типографика кита — единый источник правды.
 *
 * Три потребителя:
 *  - `cn.ts` — SCALE/COLORS/ROLES уходят в classGroups extendTailwindMerge,
 *    чтобы кастомные M3-классы не схлопывались во встроенный text-color catch-all;
 *  - `Text.svelte` — ROLE_TAG/TONE_CLASS (класс роли тривиален: `text-${role}`);
 *  - `styles/typography-roles.css` — utility-алиасы `.text-<role>` (правятся руками,
 *    синхронно с ROLES; тест на рассинхрон — в typography.test.ts).
 */

/** 15 M3-шкал из styles/typescale.css (суффиксы классов text-*). */
export const SCALE = [
  'display-lg', 'display-md', 'display-sm',
  'headline-lg', 'headline-md', 'headline-sm',
  'title-lg', 'title-md', 'title-sm',
  'body-lg', 'body-md', 'body-sm',
  'label-lg', 'label-md', 'label-sm',
] as const;

/** Цветовые токены из styles/tokens.css (суффиксы классов text-*). Анти-дрейф — тест. */
export const COLORS = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'background', 'on-background',
  'surface', 'on-surface', 'surface-variant', 'on-surface-variant',
  'surface-dim', 'surface-bright',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'inverse-surface', 'inverse-on-surface', 'inverse-primary',
  'outline', 'outline-variant',
  'success', 'on-success', 'warning', 'on-warning', 'info', 'on-info',
  'scrim', 'shadow',
] as const;

/**
 * Роли текста. Значение role совпадает с именем utility-алиаса без префикса:
 * role="page-title" ↔ класс .text-page-title.
 */
export const ROLES = [
  'page-title', 'section-title', 'group-title',
  'item-title', 'item-subtitle',
  'body', 'hint', 'caption',
  'action', 'label', 'overline',
] as const;

export type TextRole = (typeof ROLES)[number];

/** Дефолтный HTML-тег роли (перебивается пропом `as`). */
export const ROLE_TAG: Record<TextRole, string> = {
  'page-title': 'h1',
  'section-title': 'h2',
  'group-title': 'h3',
  'item-title': 'div',
  'item-subtitle': 'div',
  body: 'p',
  hint: 'p',
  caption: 'p',
  action: 'span',
  label: 'span',
  overline: 'span',
};

export const TONES = [
  'default', 'muted', 'inherit',
  'primary', 'secondary', 'tertiary',
  'error', 'success', 'warning',
] as const;

export type TextTone = (typeof TONES)[number];

/**
 * Класс тона. Дефолтный тон роли уже зашит в её utility-алиас, поэтому проп
 * `tone` всегда ПЕРЕБИВАЕТ цвет классом из @layer utilities (слой сильнее
 * components). 'inherit' обязан быть непустым text-inherit — пустая строка
 * не сняла бы цвет алиаса.
 */
export const TONE_CLASS: Record<TextTone, string> = {
  default: 'text-on-surface',
  muted: 'text-on-surface-variant',
  inherit: 'text-inherit',
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
  success: 'text-success',
  warning: 'text-warning',
};
