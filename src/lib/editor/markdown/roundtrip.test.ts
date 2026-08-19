import { describe, it, expect } from 'vitest';
import { parseMarkdown, serializeMarkdown } from './index';
import { editorSchema } from '../schema';

/**
 * Контракт md-моста: `serialize(parse(md))` не теряет содержимого и идемпотентен со
 * второго прогона.
 *
 * Побайтового равенства с ВХОДНЫМ md не обещаем — нормализация маркеров списков и пустых
 * строк допустима, диффы версий текстовые и это переживают. А вот второй прогон обязан
 * совпасть с первым: иначе документ «плывёт» при каждом открытии-сохранении, и история
 * версий заполняется мусорными изменениями.
 */

const roundtrip = (md: string) => serializeMarkdown(parseMarkdown(md));

/** Основная проверка: содержимое сохранено (по ожидаемым фрагментам) и результат устойчив. */
function expectStable(md: string, expectedFragments: string[]) {
  const once = roundtrip(md);
  for (const fragment of expectedFragments) expect(once).toContain(fragment);
  expect(roundtrip(once)).toBe(once);
}

describe('markdown round-trip', () => {
  it('заголовки всех шести уровней', () => {
    const md = ['# h1', '', '## h2', '', '### h3', '', '#### h4', '', '##### h5', '', '###### h6'].join('\n');
    expectStable(md, ['# h1', '## h2', '###### h6']);
  });

  it('вложенные списки', () => {
    const md = ['1. первый', '   - вложенный a', '   - вложенный b', '2. второй'].join('\n');
    expectStable(md, ['первый', 'вложенный a', 'второй']);
    const doc = parseMarkdown(md);
    expect(doc.firstChild?.type.name).toBe('ordered_list');
  });

  it('цитата, код-блок с языком и инлайн-код', () => {
    const md = ['> цитата', '', '```ts', 'const a = 1;', '```', '', 'текст с `кодом` внутри'].join('\n');
    expectStable(md, ['> цитата', '```ts', 'const a = 1;', '`кодом`']);
  });

  it('инлайн-марки: strong, em, strike', () => {
    expectStable('**жирный** *курсив* ~~зачёркнутый~~', ['**жирный**', '*курсив*', '~~зачёркнутый~~']);
  });

  it('underline и highlight переживают круг как инлайновый HTML', () => {
    const md = '<u>подчёркнутый</u> и <mark>маркер</mark>';
    expectStable(md, ['<u>подчёркнутый</u>', '<mark>маркер</mark>']);
    const doc = parseMarkdown(md);
    const marks = new Set<string>();
    doc.descendants((node) => {
      node.marks.forEach((m) => marks.add(m.type.name));
    });
    expect(marks).toContain('underline');
    expect(marks).toContain('highlight');
  });

  it('картинка сохраняет alt и title', () => {
    const md = '![Схема заезда](https://cdn.example.com/plan.png "Как добраться")';
    expectStable(md, ['![Схема заезда](https://cdn.example.com/plan.png "Как добраться")']);
    const doc = parseMarkdown(md);
    const image = doc.firstChild?.firstChild;
    expect(image?.type.name).toBe('image');
    expect(image?.attrs.title).toBe('Как добраться');
  });

  it('нераспознанный инлайновый HTML остаётся текстом, а не исполняется', () => {
    const out = roundtrip('текст с <abbr title="x">аббревиатурой</abbr>');
    expect(out).toContain('аббревиатурой');
    const doc = parseMarkdown('<abbr title="x">a</abbr>');
    let hasElementNode = false;
    doc.descendants((node) => {
      if (node.type.name !== 'text' && node.isInline) hasElementNode = true;
    });
    expect(hasElementNode).toBe(false);
  });

  it('блочный HTML не роняет парсер и доезжает текстом', () => {
    const out = roundtrip('<div class="x">содержимое</div>');
    expect(out).toContain('содержимое');
    expect(roundtrip(out)).toBe(out);
  });

  it('ссылки, картинки и горизонтальная линия', () => {
    const md = ['[текст](https://example.com)', '', '![альт](https://example.com/i.png)', '', '---'].join('\n');
    expectStable(md, ['[текст](https://example.com)', '![альт](https://example.com/i.png)', '---']);
  });

  it('переменная становится атомарным чипом и сериализуется обратно', () => {
    const doc = parseMarkdown('Здравствуйте, {{appName}} — {{brand.legalName}}.');
    const names: string[] = [];
    doc.descendants((node) => {
      if (node.type === editorSchema.nodes.variable) names.push(node.attrs.name as string);
    });
    expect(names).toEqual(['appName', 'brand.legalName']);
    expectStable('Здравствуйте, {{appName}} — {{brand.legalName}}.', ['{{appName}}', '{{brand.legalName}}']);
  });

  it('одинарные и битые фигурные скобки переменной не ломают текст', () => {
    expectStable('{одна} и {{ незакрытая', ['{одна}', '{{ незакрытая']);
  });

  it('GFM-таблица', () => {
    const md = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n');
    const doc = parseMarkdown(md);
    expect(doc.firstChild?.type.name).toBe('table');
    expectStable(md, ['| A | B |', '| --- | --- |', '| 1 | 2 |']);
  });

  it('таблица с трубой в ячейке экранирует её', () => {
    const md = ['| A | B |', '| --- | --- |', '| a \\| b | c |'].join('\n');
    const out = roundtrip(md);
    expect(out).toContain('a \\| b');
    expect(roundtrip(out)).toBe(out);
    // Экранированная труба не должна порождать лишний столбец.
    const doc = parseMarkdown(out);
    doc.descendants((node) => {
      if (node.type.name === 'table_row') expect(node.childCount).toBe(2);
    });
  });

  it('таблица с инлайн-разметкой в ячейках', () => {
    const md = ['| A | B |', '| --- | --- |', '| **жир** | [ссылка](https://e.com) |'].join('\n');
    expectStable(md, ['**жир**', '[ссылка](https://e.com)']);
  });

  it('смешанный документ целиком', () => {
    const md = [
      '# Договор {{brand.legalName}}',
      '',
      'Вводный абзац со **значимым** словом.',
      '',
      '## Условия',
      '',
      '- первое',
      '- второе',
      '',
      '| Услуга | Цена |',
      '| --- | --- |',
      '| Уборка | 5000 |',
      '',
      '> Примечание.',
    ].join('\n');
    expectStable(md, ['# Договор {{brand.legalName}}', '## Условия', '| Услуга | Цена |', '> Примечание.']);
  });

  it('пустой вход даёт пустой выход', () => {
    expect(roundtrip('')).toBe('');
  });
});
