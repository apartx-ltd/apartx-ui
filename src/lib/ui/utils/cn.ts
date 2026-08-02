import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { COLORS, ROLES, SCALE } from './typography';

/*
 * Дефолтный twMerge не знает кастомных M3-классов: `text-body-md` не проходит
 * валидатор font-size (не t-shirt-размер) и падает в text-color с catch-all —
 * в одну группу с `text-on-surface-variant`. Внутри группы выживает последний,
 * и размер шрифта молча исчезал (Title, ListHeader, DataTable, Pagination,
 * календари). Явные группы чинят это; text-role — своя группа, чтобы алиас
 * роли не конфликтовал ни со шкалой, ни с цветом (их разводит CSS-каскад:
 * utilities сильнее components).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...SCALE] }],
      'text-color': [{ text: [...COLORS] }],
      'text-role': [{ text: [...ROLES] }],
    },
  },
});

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * Combines clsx (conditional classes) + tailwind-merge (dedup).
 *
 * @example
 * cn('px-4 py-2', active && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
