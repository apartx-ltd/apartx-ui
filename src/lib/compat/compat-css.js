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

const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i;
// Во что Tailwind компилирует модификатор `/N` на цвете темы: `bg-on-surface/12`.
const ALPHA_MIX = /color-mix\(in oklab,\s*var\((--color-[\w-]+)\)\s*([\d.]+)%,\s*transparent\)/g;

/** `#1a1c1e` → `26 28 30`; не hex (или hex с альфой) — null. */
export function rgbChannels(value) {
  const hex = value.trim().match(HEX)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

/**
 * `--theme-X: #hex` → рядом `--theme-X-rgb: r g b`, в том же правиле (бренд, тёмная тема).
 * Каналы нужны фолбэку прозрачности: `rgb(var(--theme-X-rgb) / .12)` понимает Safari 13.4,
 * а color-mix — только Safari 16.2 / Chrome 111.
 */
export function addThemeChannels(root) {
  root.walkDecls(/^--theme-/, (decl) => {
    const channels = rgbChannels(decl.value);
    if (channels) decl.cloneAfter({ prop: `${decl.prop}-rgb`, value: channels });
  });
}

/**
 * Модификатор `/N` на цвете темы (`--color-X: var(--theme-X, #hex)`) Tailwind компилирует в
 * сплошной `var(--color-X)` и color-mix под `@supports`. Движок без color-mix остаётся со
 * сплошным цветом: нажатый `Item` заливается on-surface, текст того же цвета пропадает.
 *
 * Перед каждым таким `@supports` ставим его копию, где color-mix заменён на
 * `rgb(var(--theme-X-rgb, r g b) / N)`: она перекрывает сплошной фолбэк, а новые движки
 * по-прежнему берут `@supports` — он ниже. Именно вставка, а не правка фолбэка: в проде
 * Tailwind склеивает селекторы (`.bg-x,.bg-x\/8{…}`), и фолбэк общий с непрозрачной утилитой.
 */
export function addAlphaFallbacks(root) {
  const channels = new Map();
  root.walkDecls(/^--color-/, (decl) => {
    const [, themeVar, hex] = decl.value.match(/^var\((--theme-[\w-]+),\s*(#[\da-f]+)\)$/i) ?? [];
    const fallback = hex && rgbChannels(hex);
    if (fallback) channels.set(decl.prop, `var(${themeVar}-rgb, ${fallback})`);
  });

  const blocks = [];
  root.walkAtRules('supports', (block) => {
    if (block.params.includes('color-mix')) blocks.push(block);
  });
  for (const block of blocks) {
    const copy = block.clone();
    copy.walkDecls((decl) => {
      const value = decl.value.replace(ALPHA_MIX, (mix, color, percent) =>
        channels.has(color) ? `rgb(${channels.get(color)} / ${percent / 100})` : mix,
      );
      if (value === decl.value || value.includes('color-mix(')) {
        decl.remove();
        return;
      }
      decl.value = value;
    });
    const rules = [];
    copy.walkRules((rule) => rules.push(rule));
    for (const rule of rules.reverse()) if (!rule.nodes.length) rule.remove();
    if (copy.nodes.length) block.before(copy.nodes);
  }
}

export function compatCss(css, { from = 'compat.css' } = {}) {
  const root = postcss.parse(css, { from });
  assertLayersFirst(root);
  flattenLayers(root);
  addViewportUnitFallbacks(root);
  addThemeChannels(root);
  addAlphaFallbacks(root);
  const { code } = transform({
    filename: from,
    code: Buffer.from(root.toString()),
    targets: TARGETS,
    errorRecovery: true,
  });
  return code.toString();
}
