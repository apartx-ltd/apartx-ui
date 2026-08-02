import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { COLORS, ROLES, ROLE_TAG, SCALE, TONES, TONE_CLASS } from './typography';

describe('typography maps', () => {
  test('каждая роль имеет тег', () => {
    for (const role of ROLES) {
      expect(ROLE_TAG[role], `нет тега для роли ${role}`).toBeTruthy();
    }
  });

  test('каждый тон имеет класс', () => {
    for (const tone of TONES) {
      expect(TONE_CLASS[tone], `нет класса для тона ${tone}`).toMatch(/^text-/);
    }
  });

  test('inherit-тон — это text-inherit, а не пустая строка', () => {
    // Дефолтный цвет зашит в utility-алиас роли; пустая строка его бы не сняла.
    expect(TONE_CLASS.inherit).toBe('text-inherit');
  });

  test('SCALE — 15 M3-шкал', () => {
    expect(SCALE).toHaveLength(15);
  });

  test('SCALE, COLORS и ROLES не пересекаются', () => {
    // Каждый список — отдельная classGroup в cn.ts. Общий литерал (например роль
    // с именем primary) заставил бы одну группу молча затенить другую.
    const all = [...SCALE, ...COLORS, ...ROLES];
    expect(all).toHaveLength(new Set(all).size);
  });

  test('ROLES синхронизирован с алиасами в typography-roles.css', () => {
    // Роль без CSS-правила рендерится вообще без стилей — тихо, мимо сборки и типов.
    const css = readFileSync(new URL('../../styles/typography-roles.css', import.meta.url), 'utf8');
    const aliases = [...css.matchAll(/^\s*\.text-([a-z-]+)\s*\{/gm)].map((m) => m[1]);
    expect(aliases.sort()).toEqual([...ROLES].sort());
  });

  test('COLORS синхронизирован с --color-* из tokens.css (анти-дрейф)', () => {
    // Новый токен без записи здесь снова начнёт молча съедать шкалу в twMerge.
    const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');
    const tokens = [...new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]))];
    expect([...COLORS].sort()).toEqual(tokens.sort());
  });
});
