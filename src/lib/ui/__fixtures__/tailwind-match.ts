// Тестовый хелпер: включена ли на элементе утилита Tailwind, повешенная под вариантом.
// jsdom не вычисляет Tailwind, а варианты состояния (`group-data-[state=open]/x:`,
// `[[data-state=checked]_&]:`) — это селекторы. Компилируем классы элемента с этой утилитой
// настоящим Tailwind, разворачиваем вложенность lightningcss и матчим селекторы правил на
// самом элементе — так проверяется и то, ЧЬЁ состояние включает утилиту.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { transform } from 'lightningcss';

const require = createRequire(import.meta.url);

async function ruleSelectors(classes: string[]): Promise<string[]> {
  const compiler = await compile('@import "tailwindcss/utilities";', {
    base: process.cwd(),
    loadStylesheet: async (id: string, base: string) => {
      const path = require.resolve(id === 'tailwindcss/utilities' ? 'tailwindcss/utilities.css' : id);
      return { content: readFileSync(path, 'utf8'), base, path };
    },
  });
  // targets ниже поддержки CSS nesting — lightningcss разворачивает `&` в плоские селекторы.
  const flat = transform({
    filename: 'utilities.css',
    code: Buffer.from(compiler.build(classes)),
    targets: { chrome: 90 << 16 },
  }).code.toString();
  const css = flat.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{};]+)\{/g)].map((m) => m[1].trim());
}

/** true — класс элемента `utility` (сам или под вариантом `…:utility`) сейчас к нему применяется. */
export async function utilityApplies(el: Element, utility: string): Promise<boolean> {
  const classes = [...el.classList].filter((c) => c === utility || c.endsWith(`:${utility}`));
  // Только правила самой утилиты: служебные `@layer properties { *, :before … }` матчат всё.
  const selectors = (await ruleSelectors(classes)).filter((s) => s.includes(utility));
  // nwsapi (jsdom) не матчит экранированные имена вида `.\[\[data-state\=x\]_\&\]\:…`,
  // поэтому класс самого элемента подменяем атрибутом-меткой; предки остаются как есть.
  const probed = selectors.map((s) =>
    classes.reduce((acc, c) => acc.split(`.${c.replace(/[^\w-]/g, (ch) => `\\${ch}`)}`).join('[data-tw-probe]'), s),
  );
  if (!probed.length || probed.some((s) => !s.includes('[data-tw-probe]')))
    throw new Error(`utilityApplies: нет селектора с классом ${utility}: ${selectors.join(' | ')}`);
  el.setAttribute('data-tw-probe', '');
  const applies = probed.some((s) => el.matches(s));
  el.removeAttribute('data-tw-probe');
  return applies;
}
