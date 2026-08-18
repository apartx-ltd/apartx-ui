// markdown → PM-документ.
//
// Берём markdown-it (тот же движок, что внутри prosemirror-markdown) и досыпаем три
// правила, которых в нём нет для нашей схемы:
//   1. `{{name}}` → атомарный токен переменной;
//   2. парные <u>/<mark> → марки (в markdown их нет, это наш инлайновый HTML);
//   3. параграф внутрь ячеек таблицы (markdown-it кладёт в th/td голый inline, а наша
//      table_cell содержит paragraph).
// Всё остальное — дефолтные токены prosemirror-markdown.
import MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { MarkdownParser, defaultMarkdownParser } from 'prosemirror-markdown';
import type { Node as ProseNode } from 'prosemirror-model';
import { editorSchema, VARIABLE_NAME } from '../schema';

/** `{{ appName }}` / `{{brand.legalName}}`. Пробелы внутри допускаем, имя нормализуем. */
const VARIABLE_TOKEN = /^\{\{\s*([\w.]+)\s*\}\}/;

/** Инлайновый HTML, который мы понимаем как марку: `<u>`, `</mark>` и т.п. */
const MARK_TAG = /^<(\/?)(u|mark)\s*>$/i;

/**
 * Инлайн-правило: `{{name}}` → токен `variable`.
 *
 * Регистрируется ДО `text`-правила, иначе фигурные скобки уже уедут в текстовый буфер.
 * Не совпало — возвращаем false, и markdown-it сам разберётся: одиночные `{` и незакрытые
 * `{{` обязаны остаться обычным текстом.
 */
function variableRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x7b /* { */) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 0x7b) return false;

  const match = VARIABLE_TOKEN.exec(state.src.slice(state.pos));
  if (!match) return false;

  if (!silent) {
    const token = state.push('variable', '', 0);
    token.content = match[1];
  }
  state.pos += match[0].length;
  return true;
}

/**
 * Core-правило: парные `<u>`/`<mark>` → open/close-токены марок, остальной инлайновый HTML
 * → текст.
 *
 * Почему текстом, а не как есть: html_inline попадает в документ сырой строкой, и всё, что
 * мы не разобрали, обязано доехать до автора видимым текстом — иначе разметка молча
 * исчезает при сохранении. Непарные `<u>` (нет закрывающего) тоже уходят в текст: марку без
 * пары ставить некуда.
 */
function htmlMarksRule(state: StateCore): void {
  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !blockToken.children) continue;

    const open = new Map<string, number[]>();
    blockToken.children.forEach((token, index) => {
      if (token.type !== 'html_inline') return;
      const match = MARK_TAG.exec(token.content.trim());
      if (!match) return;
      const [, closing, rawTag] = match;
      const tag = rawTag.toLowerCase();
      if (!closing) {
        const stack = open.get(tag) ?? [];
        stack.push(index);
        open.set(tag, stack);
        return;
      }
      const openIndex = open.get(tag)?.pop();
      if (openIndex === undefined) return;
      convert(blockToken.children![openIndex], `${tag}_open`, tag, 1);
      convert(token, `${tag}_close`, tag, -1);
    });

    // Всё, что осталось html_inline — чужие теги и непарные <u>/<mark> — уходит текстом.
    // Парсер такой токен не знает и без этого падает; а молча выбрасывать разметку нельзя,
    // автор должен видеть то, что написал.
    for (const token of blockToken.children) {
      if (token.type !== 'html_inline') continue;
      token.type = 'text';
      token.tag = '';
      token.nesting = 0;
    }
  }
}

function convert(token: Token, type: string, tag: string, nesting: 1 | -1): void {
  token.type = type;
  token.tag = tag;
  token.nesting = nesting;
  token.content = '';
}

/**
 * Core-правило: обернуть содержимое ячеек в параграф.
 *
 * markdown-it выдаёт `th_open, inline, th_close`, а наша схема ждёт внутри ячейки
 * paragraph. Дешевле поправить поток токенов, чем разрешать ячейке inline-контент: тогда
 * сериализатор и команды таблиц пришлось бы учить обоим вариантам.
 */
function cellParagraphRule(state: StateCore): void {
  const out: Token[] = [];
  for (const token of state.tokens) {
    const isCellOpen = token.type === 'th_open' || token.type === 'td_open';
    const isCellClose = token.type === 'th_close' || token.type === 'td_close';
    if (isCellOpen) {
      out.push(token, new state.Token('paragraph_open', 'p', 1));
      continue;
    }
    if (isCellClose) {
      out.push(new state.Token('paragraph_close', 'p', -1), token);
      continue;
    }
    out.push(token);
  }
  state.tokens = out;
}

/**
 * `html: true` нужен ровно для <u>/<mark>: без него markdown-it спрячет их в текст ещё до
 * наших правил. Санитайза это не отменяет — рендером наружу занимается сервер (marked +
 * DOMPurify), а здесь HTML никогда не становится DOM'ом: он либо марка, либо текст.
 */
const markdownIt = MarkdownIt('default', { html: true })
  .enable(['table', 'strikethrough'])
  // Блочный HTML выключен намеренно: разбирать его нам некуда (в схеме нет html-ноды), а
  // токен html_block парсер prosemirror-markdown не принимает и падает. Выключенное
  // правило means строка вроде `<div>…</div>` разбирается как обычный параграф, и её теги
  // доезжают до автора текстом — тем же путём, что и нераспознанный инлайновый HTML.
  .disable('html_block')
  .use((md) => {
    md.inline.ruler.before('text', 'variable', variableRule);
    md.core.ruler.push('html_marks', htmlMarksRule);
    md.core.ruler.push('cell_paragraph', cellParagraphRule);
  });

export const markdownParser = new MarkdownParser(editorSchema, markdownIt, {
  ...defaultMarkdownParser.tokens,
  s: { mark: 'strike' },
  u: { mark: 'underline' },
  mark: { mark: 'highlight' },
  variable: {
    node: 'variable',
    getAttrs: (token) => ({ name: token.content }),
  },
  table: { block: 'table' },
  // thead/tbody в схеме нет: строки лежат прямо в таблице, как и в GFM.
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: { block: 'table_header' },
  td: { block: 'table_cell' },
});

export function parseMarkdown(markdown: string): ProseNode {
  return markdownParser.parse(markdown ?? '');
}

export { VARIABLE_NAME };
