// Команды и запросы состояния для UI-обвязки.
//
// Тулбары, bubble и меню вставки работают ТОЛЬКО через этот модуль: он знает про схему,
// а компоненты — нет. Иначе каждая кнопка начинает сама лазить в prosemirror-* и правила
// расползаются по трём файлам.
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, deleteTable, isInTable } from 'prosemirror-tables';
import { Selection, type Command, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { MarkType, NodeType } from 'prosemirror-model';
import { editorSchema } from './schema';

const { nodes, marks } = editorSchema;

/** Марка активна, если она в storedMarks (курсор) или покрывает весь диапазон выделения. */
export function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return Boolean(markType.isInSet(state.storedMarks || $from.marks()));
  return state.doc.rangeHasMark(from, to, markType);
}

/** Блок активен, если ВСЕ текстблоки выделения — этого типа с этими атрибутами. */
export function isBlockActive(state: EditorState, nodeType: NodeType, attrs = {}): boolean {
  const { from, to } = state.selection;
  let seen = false;
  let allMatch = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isTextblock) return true;
    seen = true;
    const matches =
      node.type === nodeType &&
      Object.entries(attrs).every(([key, value]) => node.attrs[key] === value);
    if (!matches) allMatch = false;
    return false;
  });
  return seen && allMatch;
}

/** Курсор внутри списка данного типа. */
export function isInList(state: EditorState, nodeType: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodeType) return true;
  }
  return false;
}

export const toggleStrong = toggleMark(marks.strong);
export const toggleEm = toggleMark(marks.em);
export const toggleUnderline = toggleMark(marks.underline);
export const toggleStrike = toggleMark(marks.strike);
export const toggleHighlight = toggleMark(marks.highlight);
export const toggleCode = toggleMark(marks.code);

export const setParagraph = setBlockType(nodes.paragraph);
export const setCodeBlock = setBlockType(nodes.code_block);

export function setHeading(level: number): Command {
  return setBlockType(nodes.heading, { level });
}

/**
 * Заголовок-переключатель: повторное нажатие на активный уровень возвращает абзац.
 * Без этого автор не может «снять» заголовок той же кнопкой, которой поставил.
 */
export function toggleHeading(level: number): Command {
  return (state, dispatch, view) =>
    isBlockActive(state, nodes.heading, { level })
      ? setParagraph(state, dispatch, view)
      : setHeading(level)(state, dispatch, view);
}

/** Списки-переключатели: внутри списка того же типа — снимаем, иначе оборачиваем. */
function toggleList(listType: NodeType): Command {
  return (state, dispatch, view) =>
    isInList(state, listType)
      ? liftListItem(nodes.list_item)(state, dispatch, view)
      : wrapInList(listType)(state, dispatch, view);
}

export const toggleBulletList = toggleList(nodes.bullet_list);
export const toggleOrderedList = toggleList(nodes.ordered_list);

export const toggleBlockquote: Command = (state, dispatch, view) => {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodes.blockquote) return lift(state, dispatch);
  }
  return wrapIn(nodes.blockquote)(state, dispatch, view);
};

export const insertHorizontalRule: Command = (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(nodes.horizontal_rule.create()).scrollIntoView());
  return true;
};

export function insertImage(src: string, alt = '', title = ''): Command {
  return (state, dispatch) => {
    if (!src) return false;
    // Пустые alt/title — null, а не '': сериализатор пишет title по truthy-проверке, и ''
    // безопасен, но null держит атрибуты в дефолте схемы (документы сравнимы по equals).
    const attrs = { src, alt: alt || null, title: title || null };
    dispatch?.(state.tr.replaceSelectionWith(nodes.image.create(attrs)).scrollIntoView());
    return true;
  };
}

export function insertVariable(name: string): Command {
  return (state, dispatch) => {
    if (!name) return false;
    dispatch?.(state.tr.replaceSelectionWith(nodes.variable.create({ name })).scrollIntoView());
    return true;
  };
}

/**
 * Таблица rows×cols: первая строка — шапка (в GFM таблицы без шапки не бывает).
 * Курсор ставится в первую ячейку, чтобы можно было сразу печатать.
 */
export function insertTable(rows = 3, cols = 3): Command {
  return (state, dispatch) => {
    const buildRow = (cellType: NodeType) => {
      const cells = Array.from({ length: cols }, () => cellType.createAndFill());
      if (cells.some((cell) => !cell)) return null;
      return nodes.table_row.create(null, cells as never[]);
    };

    const header = buildRow(nodes.table_header);
    const body = Array.from({ length: Math.max(0, rows - 1) }, () => buildRow(nodes.table_cell));
    if (!header || body.some((row) => !row)) return false;
    const table = nodes.table.create(null, [header, ...(body as never[])]);

    if (!dispatch) return true;
    const tr = state.tr.replaceSelectionWith(table).scrollIntoView();

    // Курсор — в первую ячейку. Позицию таблицы берём подъёмом от того места, куда
    // ProseMirror сам поставил выделение, и уже от неё идём вперёд через Selection.near:
    // так не приходится считать смещение по вложенности (table > row > cell > paragraph),
    // а промах на единицу ставит выделение НА ячейку вместо текста внутри — ProseMirror
    // ругается «endpoint not pointing into a node with inline content».
    //
    // Отсчитывать назад от выделения (`from - table.nodeSize`) нельзя: после вставки курсор
    // стоит ВНУТРИ таблицы — в последней ячейке, — а не за ней, и на пустом документе
    // разность уходит в минус (RangeError, таблица не появляется вовсе).
    const $pos = tr.doc.resolve(tr.selection.from);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type !== nodes.table) continue;
      tr.setSelection(Selection.near(tr.doc.resolve($pos.before(depth) + 1), 1));
      break;
    }
    dispatch(tr);
    return true;
  };
}

/** Действия над таблицей для bubble — показываются только когда курсор в таблице. */
export const tableCommands = {
  addRowAfter,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
};

export { isInTable };

/** Ссылка: ставит марку на выделение (или на вставленный текст, если выделения нет). */
export function applyLink(href: string, text?: string): Command {
  return (state, dispatch) => {
    if (!href) return false;
    const { from, to, empty } = state.selection;
    const mark = marks.link.create({ href, title: null });
    if (!dispatch) return true;

    if (empty) {
      const label = text || href;
      dispatch(state.tr.insertText(label, from).addMark(from, from + label.length, mark));
      return true;
    }
    dispatch(state.tr.addMark(from, to, mark).removeStoredMark(marks.link));
    return true;
  };
}

export const removeLink: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  dispatch?.(state.tr.removeMark(from, to, marks.link));
  return true;
};

/** href под курсором — для попапа редактирования ссылки. */
export function activeLinkHref(state: EditorState): string | null {
  const { $from } = state.selection;
  const mark = marks.link.isInSet(state.storedMarks || $from.marks());
  return mark ? (mark.attrs.href as string) : null;
}

/** Выполнить команду и вернуть фокус в редактор — общий хвост всех кнопок тулбара. */
export function run(view: EditorView | null, command: Command): void {
  if (!view) return;
  command(view.state, view.dispatch, view);
  view.focus();
}
