import { describe, expect, test } from 'vitest';
import { cn } from './cn';

// Регрессия на бамп tailwind-merge: его внутренняя модель classGroups —
// peer-чувствительная зависимость, при мажоре эти кейсы должны падать первыми.
describe('cn: кастомная типошкала не конфликтует с цветом', () => {
  test.each([
    // [вход A, вход B, ожидание]
    ['text-title-lg text-on-surface truncate', '', 'text-title-lg text-on-surface truncate'],
    ['px-4 py-2 text-label-lg text-on-surface-variant', '', 'px-4 py-2 text-label-lg text-on-surface-variant'],
    ['text-body-md text-on-surface-variant', 'text-error', 'text-body-md text-error'],
    ['text-body-sm text-on-surface-variant', 'text-body-lg', 'text-on-surface-variant text-body-lg'],
    ['text-on-surface', 'text-on-surface-variant', 'text-on-surface-variant'],
    // роль — отдельная группа: не конфликтует ни со шкалой, ни с цветом
    ['text-hint', 'text-error', 'text-hint text-error'],
    ['text-hint', 'text-caption', 'text-caption'],
    ['text-caption', 'text-body-lg', 'text-caption text-body-lg'],
    ['text-hint', 'text-inherit', 'text-hint text-inherit'],
    // штатный Tailwind не задет расширением
    ['text-sm text-red-500', 'text-lg', 'text-red-500 text-lg'],
  ])('cn(%j, %j) → %j', (a, b, expected) => {
    expect(cn(a, b)).toBe(expected);
  });
});
