// Вставка сырого markdown из буфера.
//
// Штатное поведение ProseMirror: есть text/html — вставляем его, иначе plain-текст как
// текст. Для markdown-редактора этого мало. Браузер при копировании почти всегда кладёт и
// html тоже — пустой обёрткой `<meta><span style="white-space:pre">…тот же текст…</span>`,
// и «## Заголовок / - пункт» приезжает одним абзацем видимым текстом.
//
// Правило: парсим текст как markdown, если в нём есть явный блочный маркер И html не несёт
// ничего сверх plain-текста (содержимое совпадает с точностью до пробелов). Скопированный
// со страницы РЕНДЕР под правило не попадает: у него в html теги, а в тексте разметки нет —
// содержимое различается, и вставка идёт штатным путём с сохранением форматирования.
import { Plugin } from 'prosemirror-state';
import { DOMParser as ProseDOMParser, DOMSerializer } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { editorSchema } from '../schema';
import { parseMarkdown } from '../markdown';

/**
 * Заголовок, список, нумерованный список, цитата, забор кода, таблица.
 *
 * Только явные маркеры: одного «текст в несколько абзацев» мало — под такое описание
 * попадает и обычный рендер, скопированный со страницы, и правило начало бы съедать
 * нормальную html-вставку. Одиночное слово или фраза сюда тоже не попадают: их вставка
 * остаётся строчной.
 */
export const MD_BLOCK = /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|\|)/m;

/** Языки, для которых копия из VS Code — текст, а не код. */
const VSCODE_TEXT_MODES = new Set(['markdown', 'mdx', 'plaintext']);

/**
 * true — из VS Code скопирован КОД, его надо оставить код-блоком.
 *
 * Смотреть на `mode` обязательно: у сниппетов кода строки сплошь и рядом начинаются с `#`
 * (комментарий) или `- `, и без этой проверки эвристика блочных маркеров разобрала бы код
 * на заголовок со списком.
 */
export function isVsCodeCodePaste(raw: string): boolean {
  if (!raw) return false;
  try {
    return !VSCODE_TEXT_MODES.has(JSON.parse(raw)?.mode);
  } catch {
    return true;
  }
}

const squash = (value: string) => value.replace(/\s+/g, '');

export function htmlText(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const text = template.content.textContent ?? '';
  template.remove();
  return text;
}

/** html не несёт ничего сверх plain-текста. */
export function htmlIsPlainWrapper(html: string, text: string): boolean {
  if (!html) return true;
  return squash(htmlText(html)) === squash(text);
}

export function shouldParseAsMarkdown(clipboardData: DataTransfer): boolean {
  if (isVsCodeCodePaste(clipboardData.getData('vscode-editor-data'))) return false;
  const text = clipboardData.getData('text/plain');
  if (!text || !MD_BLOCK.test(text)) return false;
  return htmlIsPlainWrapper(clipboardData.getData('text/html'), text);
}

function pasteMarkdown(view: EditorView, text: string): boolean {
  const doc = parseMarkdown(text);
  if (!doc.content.size) return false;

  // Через DOM, а не Slice напрямую: parseSlice сам расставит openStart/openEnd, и вставка
  // в середину абзаца не порвёт его лишним блоком.
  const dom = DOMSerializer.fromSchema(editorSchema).serializeFragment(doc.content);
  const slice = ProseDOMParser.fromSchema(editorSchema).parseSlice(dom);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}

export function markdownPastePlugin(): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const { clipboardData } = event as ClipboardEvent;
        if (!clipboardData) return false;
        // Внутри код-блока markdown не разбираем — там текст и должен остаться текстом.
        if (view.state.selection.$from.node().type.spec.code) return false;
        if (!shouldParseAsMarkdown(clipboardData)) return false;
        return pasteMarkdown(view, clipboardData.getData('text/plain'));
      },
    },
  });
}
