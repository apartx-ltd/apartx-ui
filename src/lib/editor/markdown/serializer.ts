// PM-документ → markdown.
//
// Дефолтный сериализатор prosemirror-markdown плюс то, что мы добавили в схему: strike,
// underline/highlight инлайновым HTML, чип переменной и GFM-таблицы.
import {
  MarkdownSerializer,
  MarkdownSerializerState,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import type { Node as ProseNode } from 'prosemirror-model';

/**
 * Ячейка → одна строка markdown.
 *
 * Труба экранируется, переносы схлопываются в пробел: и то и другое порвало бы строку
 * таблицы на лишние столбцы. Пустая ячейка отдаётся пробелом, иначе `||` слипается и GFM
 * читает строку как более короткую.
 */
function serializeCell(state: MarkdownSerializerState, cell: ProseNode): string {
  const inner = new MarkdownSerializerState(state.nodes, state.marks, state.options);
  inner.renderInline(cell.firstChild ?? cell);
  const text = inner.out.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  return text || ' ';
}

function serializeTable(state: MarkdownSerializerState, node: ProseNode): void {
  const rows: string[][] = [];
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(serializeCell(state, cell)));
    rows.push(cells);
  });
  if (!rows.length) return;

  // В GFM таблица без шапки не существует — первая строка всегда header.
  const columns = Math.max(...rows.map((r) => r.length));
  const pad = (cells: string[]) =>
    `| ${Array.from({ length: columns }, (_, i) => cells[i] ?? ' ').join(' | ')} |`;

  state.write(pad(rows[0]));
  state.write('\n');
  state.write(`| ${Array.from({ length: columns }, () => '---').join(' | ')} |`);
  state.write('\n');
  for (const row of rows.slice(1)) {
    state.write(pad(row));
    state.write('\n');
  }
  state.closeBlock(node);
}

export const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table: serializeTable,
    // Строки и ячейки печатает serializeTable целиком: по одиночке они в markdown не
    // выражаются, а MarkdownSerializer требует запись для каждой ноды схемы.
    table_row: () => {},
    table_header: () => {},
    table_cell: () => {},
    variable: (state, node) => {
      state.text(`{{${node.attrs.name}}}`, false);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    underline: { open: '<u>', close: '</u>', mixable: true, expelEnclosingWhitespace: true },
    highlight: { open: '<mark>', close: '</mark>', mixable: true, expelEnclosingWhitespace: true },
  },
);

export function serializeMarkdown(doc: ProseNode): string {
  return markdownSerializer.serialize(doc);
}
