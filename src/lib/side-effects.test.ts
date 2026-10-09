// Гард поля `sideEffects` в package.json (AGENTS.md → «sideEffects: что выкидывает сборщик»).
// Всё, что не перечислено в поле, сборщик консьюмера вправе выкинуть, если ни один экспорт модуля
// не используется. Тест не даёт модулю с побочным эффектом уровня модуля молча оказаться вне списка.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LIB = join(ROOT, 'src/lib');
const sideEffects: string[] = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).sideEffects;

// Семантика webpack/rspack/vite: шаблон без «/» ищется на любой глубине (`**/` + шаблон),
// путь модуля — относительно корня пакета, с префиксом `./`.
function toRegExp(pattern: string): RegExp {
  const glob = pattern.includes('/') ? pattern.replace(/^\.\//, '') : `**/${pattern}`;
  const src = glob
    .split('**/')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'))
    .join('(?:.*/)?');
  return new RegExp(`^${src}$`);
}
const matchers = sideEffects.map(toRegExp);
const listed = (rel: string) => matchers.some((re) => re.test(rel));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__fixtures__') walk(p, out);
    } else if (/\.(ts|js|svelte)$/.test(e.name) && !/\.test\.|\.harness\.|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(LIB).map((abs) => ({ abs, rel: relative(ROOT, abs).split(sep).join('/') }));

// Инструкции уровня модуля, которые исполняются при импорте. Объявления (`const`, `function`,
// `class`, `export …`) не в счёте: `const x = new Map()` эффекта наружу не даёт, а
// `const x = вызовСЭффектом()` — ответственность автора (см. AGENTS.md).
const EFFECT_KINDS = new Set([
  ts.SyntaxKind.ExpressionStatement, ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement, ts.SyntaxKind.TryStatement, ts.SyntaxKind.Block,
  ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.LabeledStatement, ts.SyntaxKind.ThrowStatement,
]);

function topLevelEffects(code: string, name: string): string[] {
  const sf = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  for (const st of sf.statements) {
    const line = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1;
    if (ts.isImportDeclaration(st) && !st.importClause) found.push(`${line}: голый import ${st.moduleSpecifier.getText(sf)}`);
    else if (EFFECT_KINDS.has(st.kind)) found.push(`${line}: ${st.getText(sf).split('\n')[0].slice(0, 80)}`);
  }
  return found;
}

// Модули с инструкциями уровня модуля, у которых эффект не выходит за пределы модуля.
// Каждая запись — с причиной; новую добавлять, только убедившись, что так и есть.
const LOCAL_ONLY: Record<string, string> = {
  'src/lib/chat/markdown.ts': '`md.use(...)` настраивает собственный экземпляр Marked, не глобальный `marked`',
};

describe('package.json sideEffects', () => {
  it('объявлен массивом', () => {
    expect(Array.isArray(sideEffects)).toBe(true);
  });

  it('каждый путь без маски существует', () => {
    const exact = sideEffects.filter((p) => !p.includes('*'));
    const rels = new Set(files.map((f) => f.rel));
    expect(exact.filter((p) => !rels.has(p.replace(/^\.\//, '')))).toEqual([]);
  });

  it('компоненты со <style> перечислены — иначе rspack выкинет их извлечённый CSS', () => {
    // svelte-loader с emitCss выносит <style> в виртуальный модуль `X.svelte.N.css!=!…X.svelte`.
    // rspack сверяет sideEffects пакета по настоящему ресурсу (`X.svelte`), а не по
    // `.css`-имени, поэтому `**/*.css` такой модуль не защищает (замер 0.19.0, History.md).
    const styled = files.filter((f) => f.rel.endsWith('.svelte') && /<style[\s>]/.test(readFileSync(f.abs, 'utf8')));
    expect(styled.length).toBeGreaterThan(0);
    expect(styled.filter((f) => !listed(f.rel)).map((f) => f.rel)).toEqual([]);
  });

  it('модули с побочным эффектом уровня модуля перечислены', () => {
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f.abs, 'utf8');
      const code = f.rel.endsWith('.svelte')
        ? [...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
            .filter((m) => /\bmodule\b|context=["']module["']/.test(m[1]))
            .map((m) => m[2])
            .join('\n')
        : src;
      const effects = topLevelEffects(code, f.rel);
      if (effects.length && !listed(f.rel) && !LOCAL_ONLY[f.rel]) missing.push(`${f.rel}\n  ${effects.join('\n  ')}`);
    }
    expect(missing).toEqual([]);
  });

  it('маски работают как у сборщика', () => {
    expect(listed('src/lib/compat/polyfills.js')).toBe(true);
    expect(listed('src/lib/styles/index.css')).toBe(true);
    expect(listed('src/lib/ui/forms/Checkbox.svelte')).toBe(false);
    expect(listed('src/lib/ui/forms/index.ts')).toBe(false);
  });

  it('сканер видит известные эффекты', () => {
    const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
    expect(topLevelEffects(read('src/lib/ui/utils/date.ts'), 'date.ts').length).toBeGreaterThan(0);
    expect(topLevelEffects(read('src/lib/router/history/browser.ts'), 'browser.ts').length).toBeGreaterThan(0);
    expect(topLevelEffects(read('src/lib/compat/polyfills.js'), 'polyfills.js').length).toBeGreaterThan(0);
    expect(topLevelEffects('export const x = 1; export function f() {}', 'pure.ts')).toEqual([]);
  });
});
