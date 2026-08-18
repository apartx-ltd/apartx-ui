// Схема документа редактора: базовая схема prosemirror-markdown плюс то, чего в ней нет —
// GFM-таблицы, марки strike/underline/highlight и атомарный чип переменной.
//
// Уровни заголовков схема держит все шесть: статьи от doc-agent могут содержать любой,
// и схема, которая их не принимает, покалечит документ на первом же round-trip. UI при
// этом предлагает только H1–H3 — это разные вещи, и сужать надо именно UI.
import { Schema, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

/** CSS-класс чипа переменной. Живёт здесь же: по нему схема и парсит DOM обратно. */
export const VARIABLE_CLASS = 'k-editor-variable';

/** Имя переменной: `appName`, `brand.legalName`. */
export const VARIABLE_NAME = /^[\w.]+$/;

// Ячейка держит ровно один параграф — это выразительность GFM-таблицы и ничего сверх.
// Атрибутов у ячеек нет: colspan/rowspan/выравнивание в GFM не сериализуются, а хранить
// в документе то, что теряется при сохранении, — прямой путь к сюрпризу у автора.
const tables = tableNodes({
  tableGroup: 'block',
  cellContent: 'paragraph',
  cellAttributes: {},
});

const variable: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { name: {} },
  toDOM: (node) => [
    'span',
    { class: VARIABLE_CLASS, 'data-name': node.attrs.name as string },
    `{{${node.attrs.name}}}`,
  ],
  parseDOM: [
    {
      tag: `span.${VARIABLE_CLASS}[data-name]`,
      getAttrs: (dom) => ({ name: (dom as HTMLElement).dataset.name }),
    },
  ],
};

// strike в markdown есть (GFM `~~`), а underline и highlight — нет: они сериализуются
// инлайновым HTML. DOMPurify на сервере пропускает <u> и <mark> дефолтным allowlist'ом,
// так что до читателя они доезжают.
const strike: MarkSpec = {
  parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
  toDOM: () => ['s', 0],
};

const underline: MarkSpec = {
  parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
  toDOM: () => ['u', 0],
};

const highlight: MarkSpec = {
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', 0],
};

// Заголовок в схеме prosemirror-markdown объявлен как `(text | image)*` — inline-нода в
// него не влезает, и ProseMirror роняет ЦЕЛИКОМ весь заголовок (превращая его в пустой
// параграф), а не только переменную. Расширяем до `inline*`: «Договор {{brand.legalName}}»
// — совершенно нормальный заголовок договора.
const headingSpec = markdownSchema.spec.nodes.get('heading') as NodeSpec;

export const editorSchema = new Schema({
  nodes: markdownSchema.spec.nodes
    .update('heading', { ...headingSpec, content: 'inline*' })
    .append(tables)
    .append({ variable }),
  marks: markdownSchema.spec.marks.append({ strike, underline, highlight }),
});

export type EditorSchema = typeof editorSchema;
