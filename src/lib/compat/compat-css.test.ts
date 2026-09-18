import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { collectCssProblems } from './check.js';
import { compatCss, LayerOrderError } from './compat-css.js';

describe('compatCss', () => {
  // Значения намеренно нечисловые-нецветовые: Lightning CSS нормализует цвета (blue → #00f)
  // и сливает одинаковые селекторы, поэтому проверяем не литералы, а кто победил в каскаде.
  it('разворачивает @layer, сохраняя приоритет более позднего слоя', () => {
    const out = compatCss('@layer a, b;\n@layer a { .x { z-index: 1 } }\n@layer b { .x { z-index: 2 } }');
    expect(out).not.toContain('@layer');
    // Lightning CSS сливает одинаковые селекторы, но обе декларации оставляет (на этом же
    // держатся наши vh-фолбэки), поэтому победителя определяет порядок: последняя выигрывает.
    expect(out.indexOf('z-index: 1')).toBeLessThan(out.indexOf('z-index: 2'));
  });

  it('разворачивает @layer, сохраняя исходный порядок разных правил', () => {
    const out = compatCss('@layer a { .first { z-index: 1 } }\n@layer b { .second { z-index: 2 } }');
    expect(out.indexOf('.first')).toBeGreaterThanOrEqual(0);
    expect(out.indexOf('.first')).toBeLessThan(out.indexOf('.second'));
  });

  it('падает, если нелейерное правило стоит перед слоями', () => {
    expect(() => compatCss('.stray { color: red }\n@layer a { .x { color: blue } }')).toThrow(LayerOrderError);
  });

  it('не спотыкается о } внутри строкового значения', () => {
    const out = compatCss('@layer a { .x::after { content: "}" } }\n.y { color: red }');
    expect(out).toContain('.y');
    expect(out).not.toContain('@layer');
  });

  it('ставит vh-фолбэк перед динамической единицей', () => {
    const out = compatCss('@layer a { .x { height: 100dvh } }').replace(/\s+/g, ' ');
    expect(out).toMatch(/height: ?100vh; ?height: ?100dvh/);
  });

  it('снимает oklch по таргетам', () => {
    const out = compatCss('@layer a { :root { --c: oklch(63.7% 0.237 25.331) } }');
    expect(out).not.toContain('oklch(');
  });

  it('дописывает RGB-каналы к hex-переменным темы', () => {
    const out = compatCss(':root { --theme-on-surface: #1b1b1b; --theme-scrim: #000; --theme-radius: 4px }');
    expect(out).toMatch(/--theme-on-surface-rgb: ?27 27 27/);
    expect(out).toMatch(/--theme-scrim-rgb: ?0 0 0/);
    expect(out).not.toContain('--theme-radius-rgb');
  });
});

// Вывод Tailwind 4.3 для `active:bg-on-surface/12 hover:bg-on-surface/8 bg-primary bg-primary/8`, когда
// цвет темы задан через var(): фолбэк перед @supports — сплошной var(--color-*). Без color-mix
// (Safari < 16.2, Chrome < 111) нажатый пункт заливается on-surface целиком — «чёрная полоса».
const THEME = ':root,:host{--color-on-surface:var(--theme-on-surface,#1a1c1e);--color-primary:var(--theme-primary,#1976d2)}';
const TAILWIND_DEV = `${THEME}
.bg-primary { background-color: var(--color-primary); }
.bg-primary\\/8 {
  background-color: var(--color-primary);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-primary) 8%, transparent);
  }
}
.hover\\:bg-on-surface\\/8 { &:hover { @media (hover: hover) {
  background-color: var(--color-on-surface);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-on-surface) 8%, transparent);
  }
} } }
.active\\:bg-on-surface\\/12 { &:active {
  background-color: var(--color-on-surface);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-on-surface) 12%, transparent);
  }
} }`;
// Тот же вывод после оптимизации Tailwind в проде: минифицирован, селекторы склеены.
const TAILWIND_PROD =
  THEME +
  '.bg-primary,.bg-primary\\/8{background-color:var(--color-primary)}@supports (color:color-mix(in lab, red, red)){.bg-primary\\/8{background-color:color-mix(in oklab, var(--color-primary) 8%, transparent)}}' +
  '@media (hover:hover){.hover\\:bg-on-surface\\/8:hover{background-color:var(--color-on-surface)}@supports (color:color-mix(in lab, red, red)){.hover\\:bg-on-surface\\/8:hover{background-color:color-mix(in oklab, var(--color-on-surface) 8%, transparent)}}}' +
  '.active\\:bg-on-surface\\/12:active{background-color:var(--color-on-surface)}@supports (color:color-mix(in lab, red, red)){.active\\:bg-on-surface\\/12:active{background-color:color-mix(in oklab, var(--color-on-surface) 12%, transparent)}}';

/** Что возьмёт движок без color-mix: последнее объявление вне @supports (специфичность у утилит равная). */
const legacyValue = (css: string, selector: string) => {
  let value: string | undefined;
  postcss.parse(css).walkDecls('background-color', (decl) => {
    const rule = decl.parent as postcss.Rule;
    const inSupports = (node: postcss.Node | undefined): boolean =>
      !!node && ((node.type === 'atrule' && (node as postcss.AtRule).name === 'supports') || inSupports(node.parent));
    if (!inSupports(decl) && rule.selectors?.includes(selector)) value = decl.value;
  });
  return value?.replace(/\s+/g, ' ');
};

describe.each([
  ['dev', TAILWIND_DEV],
  ['prod', TAILWIND_PROD],
])('compatCss: фолбэк модификатора прозрачности (%s)', (_name, input) => {
  const out = compatCss(input);

  it('без color-mix нажатие полупрозрачное, а не сплошное', () => {
    expect(legacyValue(out, '.active\\:bg-on-surface\\/12:active')).toMatch(
      /^rgb\(var\(--theme-on-surface-rgb, ?26 28 30\) ?\/ ?0?\.12\)$/,
    );
    expect(legacyValue(out, '.hover\\:bg-on-surface\\/8:hover')).toMatch(/^rgb\(var\(--theme-on-surface-rgb, ?26 28 30\) ?\/ ?0?\.08\)$/);
    expect(legacyValue(out, '.bg-primary\\/8')).toMatch(/^rgb\(var\(--theme-primary-rgb, ?25 118 210\) ?\/ ?0?\.08\)$/);
  });

  it('непрозрачную утилиту не трогает', () => {
    expect(legacyValue(out, '.bg-primary')).toBe('var(--color-primary)');
  });

  it('color-mix под @supports остаётся для новых движков', () => {
    expect(out).toMatch(/color-mix\(in oklab, ?var\(--color-on-surface\) 12%/);
  });

  it('гейт compat:check чист', () => {
    expect(collectCssProblems('out.css', out)).toEqual([]);
  });
});
