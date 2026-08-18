// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { MD_BLOCK, isVsCodeCodePaste, htmlIsPlainWrapper, shouldParseAsMarkdown } from './paste';

const MD = '## Heading two\n\n- item one\n- item two\n\n**bold** text\n';

/** Обёртка, которую браузер кладёт в text/html при копировании простого текста. */
const flatHtml = (text: string) => `<meta charset='utf-8'><span style="white-space:pre">${text}</span>`;

/** Копия из VS Code: построчные div/span с подсветкой того же текста. */
const vscodeHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => `<div><span style="color:#ccc">${line || '<br>'}</span></div>`)
    .join('');

const clipboard = (data: Record<string, string>) =>
  ({ getData: (type: string) => data[type] ?? '' }) as DataTransfer;

describe('MD_BLOCK — эвристика блочных маркеров', () => {
  it.each([
    ['заголовок', '## Heading'],
    ['маркированный список', '- item'],
    ['звёздочка как маркер', '* item'],
    ['нумерованный список', '1. item'],
    ['нумерованный со скобкой', '2) item'],
    ['цитата', '> quote'],
    ['забор кода', '```ts'],
    ['строка таблицы', '| A | B |'],
    ['маркер не в первой строке', 'intro\n\n- item'],
  ])('видит %s', (_name, text) => {
    expect(MD_BLOCK.test(text)).toBe(true);
  });

  it.each([
    ['одно слово', 'hello'],
    ['фразу', 'hello there, friend'],
    ['инлайн-разметку без блоков', 'text with **bold** inside'],
    ['текст рендера', 'Heading two\n\nitem one\nitem two'],
    ['дефис в середине строки', 'well-known thing'],
  ])('не видит %s', (_name, text) => {
    expect(MD_BLOCK.test(text)).toBe(false);
  });
});

describe('isVsCodeCodePaste', () => {
  it('пустое поле — вставка не из VS Code', () => {
    expect(isVsCodeCodePaste('')).toBe(false);
  });

  it.each(['markdown', 'mdx', 'plaintext'])('%s — это текст, не код', (mode) => {
    expect(isVsCodeCodePaste(JSON.stringify({ mode }))).toBe(false);
  });

  it.each(['typescript', 'python', 'coffeescript'])('%s — код', (mode) => {
    expect(isVsCodeCodePaste(JSON.stringify({ mode }))).toBe(true);
  });

  it('битый JSON трактуется как код — консервативно, без потери содержимого', () => {
    expect(isVsCodeCodePaste('{не json')).toBe(true);
  });
});

describe('htmlIsPlainWrapper', () => {
  it('пустой html ничего не несёт', () => {
    expect(htmlIsPlainWrapper('', MD)).toBe(true);
  });

  it('обёртка браузера ничего не несёт', () => {
    expect(htmlIsPlainWrapper(flatHtml(MD), MD)).toBe(true);
  });

  it('построчная разметка VS Code ничего не несёт — сравнение без учёта пробелов', () => {
    expect(htmlIsPlainWrapper(vscodeHtml(MD), MD)).toBe(true);
  });

  it('рендер несёт: в html теги, в тексте разметки нет', () => {
    const rich = '<h2>Heading two</h2><ul><li>item one</li></ul>';
    expect(htmlIsPlainWrapper(rich, MD)).toBe(false);
  });
});

describe('shouldParseAsMarkdown', () => {
  it('сырой md без html', () => {
    expect(shouldParseAsMarkdown(clipboard({ 'text/plain': MD }))).toBe(true);
  });

  it('сырой md с плоской обёрткой', () => {
    expect(shouldParseAsMarkdown(clipboard({ 'text/plain': MD, 'text/html': flatHtml(MD) }))).toBe(true);
  });

  it('.md из VS Code', () => {
    const data = {
      'text/plain': MD,
      'text/html': vscodeHtml(MD),
      'vscode-editor-data': JSON.stringify({ mode: 'markdown' }),
    };
    expect(shouldParseAsMarkdown(clipboard(data))).toBe(true);
  });

  it('код из VS Code остаётся кодом, даже если строки похожи на markdown', () => {
    const snippet = '# comment line\n- not a list\nconst a = 1;\n';
    const data = {
      'text/plain': snippet,
      'text/html': vscodeHtml(snippet),
      'vscode-editor-data': JSON.stringify({ mode: 'typescript' }),
    };
    expect(shouldParseAsMarkdown(clipboard(data))).toBe(false);
  });

  it('рендер со страницы идёт штатным html-путём', () => {
    const data = {
      'text/plain': 'Heading two\n\nitem one\nitem two',
      'text/html': '<h2>Heading two</h2><ul><li>item one</li><li>item two</li></ul>',
    };
    expect(shouldParseAsMarkdown(clipboard(data))).toBe(false);
  });

  it('обычная фраза остаётся строчной вставкой', () => {
    expect(shouldParseAsMarkdown(clipboard({ 'text/plain': 'просто фраза' }))).toBe(false);
  });
});
