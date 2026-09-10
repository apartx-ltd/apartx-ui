#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const BANNED_AT_RULES = new Set(['layer', 'container']);
const MODERN_COLOR = /(oklch|oklab|lab|lch|color-mix|light-dark)\(/;
const DYNAMIC_UNIT = /\d*\.?\d+[dsl](vh|vw|vmin|vmax)\b/;

// API новее Chrome 80, которых НЕТ в compat/polyfills.js. Полифиленное сюда не добавлять —
// в бандле оно встречается легитимно, в самом модуле полифилов.
const BANNED_JS = [
  '.toSorted(',
  '.toReversed(',
  '.toSpliced(',
  'Array.fromAsync',
  'Object.groupBy',
  'Map.groupBy',
  'crypto.randomUUID',
  'AbortSignal.timeout',
  'Promise.withResolvers',
];

const POLYFILL_MARKER = 'apartx-compat-polyfills';

const insideSupports = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'supports') return true;
  }
  return false;
};

export function collectCssProblems(file, css) {
  const problems = [];
  const root = postcss.parse(css, { from: file });

  root.walkAtRules((rule) => {
    if (BANNED_AT_RULES.has(rule.name)) problems.push(`${file}: @${rule.name} — нет на Chrome 80`);
  });

  root.walkRules((rule) => {
    if (rule.selector.includes(':has(')) problems.push(`${file}: :has() в ${rule.selector.slice(0, 60)}`);
  });

  root.walkDecls((decl) => {
    if (MODERN_COLOR.test(decl.value) && !insideSupports(decl)) {
      problems.push(`${file}: ${decl.prop} — современная цветовая функция вне @supports`);
    }
    if (!DYNAMIC_UNIT.test(decl.value)) return;
    const previous = decl.prev();
    const hasFallback =
      previous && previous.type === 'decl' && previous.prop === decl.prop && !DYNAMIC_UNIT.test(previous.value);
    if (!hasFallback) problems.push(`${file}: ${decl.prop}: ${decl.value} — без vh-фолбэка`);
  });

  return problems;
}

function* walkFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walkFiles(path);
      continue;
    }
    yield path;
  }
}

export function checkBuild(dirs) {
  const problems = [];
  let sawPolyfills = false;

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of walkFiles(dir)) {
      if (file.endsWith('.css')) {
        problems.push(...collectCssProblems(file, readFileSync(file, 'utf8')));
        continue;
      }
      if (!file.endsWith('.js')) continue;
      const js = readFileSync(file, 'utf8');
      if (js.includes(POLYFILL_MARKER)) sawPolyfills = true;
      for (const api of BANNED_JS) {
        if (js.includes(api)) problems.push(`${file}: ${api} — новее Chrome 80 и не полифилен`);
      }
    }
  }

  if (!sawPolyfills) problems.push(`в сборке нет модуля полифилов (маркер ${POLYFILL_MARKER})`);
  return problems;
}

const dirs = process.argv.slice(2);
if (dirs.length) {
  if (!dirs.some((dir) => existsSync(dir))) {
    console.error(`compat:check — нет ни одного из каталогов: ${dirs.join(', ')}; сначала соберите приложение`);
    process.exit(2);
  }
  const problems = checkBuild(dirs);
  if (problems.length) {
    console.error(`compat:check — проблем: ${problems.length}`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('compat:check — чисто');
}
