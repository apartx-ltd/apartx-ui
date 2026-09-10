import { describe, expect, it } from 'vitest';
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
});
