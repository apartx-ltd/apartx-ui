import postcss from 'postcss';
import { transform } from 'lightningcss';

// Порог поддержки — Chrome 80+ и эквиваленты (docs/plans/2026-09-10-legacy-webview-compat/design.md).
// Формат lightningcss: major << 16 | minor << 8 | patch. Таблицу держим здесь, а не в browserslist:
// одна зависимость меньше и нет риска посчитать порог по устаревшему caniuse.
const version = (major, minor = 0) => (major << 16) | (minor << 8);

export const TARGETS = {
  chrome: version(80),
  android: version(80),
  edge: version(80),
  firefox: version(78),
  safari: version(13, 4),
  ios_saf: version(13, 4),
  samsung: version(12),
};

export class LayerOrderError extends Error {}

/**
 * Нелейерное правило перед первым @layer сделало бы разворачивание слоёв изменением каскада:
 * сегодня такое правило бьёт любое правило внутри слоя, после разворачивания — проиграет всему,
 * что идёт ниже по файлу. Лучше упасть на сборке, чем молча поменять приоритеты.
 */
export function assertLayersFirst(root) {
  const firstLayer = root.nodes.findIndex((node) => node.type === 'atrule' && node.name === 'layer');
  if (firstLayer < 0) return;
  const stray = root.nodes
    .slice(0, firstLayer)
    .find((node) => node.type === 'rule' || (node.type === 'atrule' && !['charset', 'import', 'layer'].includes(node.name)));
  if (!stray) return;
  const what = stray.type === 'rule' ? stray.selector : `@${stray.name}`;
  throw new LayerOrderError(`нелейерное правило перед первым @layer (${what}) — разворачивание изменит каскад`);
}

export function flattenLayers(root) {
  root.walkAtRules('layer', (rule) => {
    if (!rule.nodes) {
      rule.remove(); // statement-форма: `@layer a, b, c;`
      return;
    }
    rule.replaceWith(rule.nodes);
  });
}

const DYNAMIC_UNIT = /(\d*\.?\d+)[dsl](vh|vw|vmin|vmax)\b/g;

/**
 * `height: 100dvh` → `height: 100vh; height: 100dvh`. Старый движок берёт первую декларацию,
 * новый — вторую. Кастом-пропы этим приёмом не спасаются (их значение валидно всегда), но в наших
 * бандлах динамических единиц в кастом-пропах нет.
 */
export function addViewportUnitFallbacks(root) {
  root.walkDecls((decl) => {
    const fallback = decl.value.replace(DYNAMIC_UNIT, '$1$2');
    if (fallback === decl.value) return;
    decl.cloneBefore({ value: fallback });
  });
}

export function compatCss(css, { from = 'compat.css' } = {}) {
  const root = postcss.parse(css, { from });
  assertLayersFirst(root);
  flattenLayers(root);
  addViewportUnitFallbacks(root);
  const { code } = transform({
    filename: from,
    code: Buffer.from(root.toString()),
    targets: TARGETS,
    errorRecovery: true,
  });
  return code.toString();
}
