// Плагины ядра: история, клавиатура, инпут-рулы, плейсхолдер, курсоры.
//
// Всё, что не про UI-обвязку, собрано здесь одним списком — чтобы Editor.svelte оставался
// сборкой, а не свалкой конфигурации.
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import {
  baseKeymap,
  chainCommands,
  exitCode,
  setBlockType,
  toggleMark,
  wrapIn,
} from 'prosemirror-commands';
import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  undoInputRule,
  InputRule,
} from 'prosemirror-inputrules';
import { splitListItem, liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { goToNextCell } from 'prosemirror-tables';
import { Plugin, type Command } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { MarkType, Schema } from 'prosemirror-model';
import { editorSchema } from './schema';

/**
 * Инпут-рул для инлайновой марки: `**жир**`, `*курсив*`, `~~зачёркнутый~~`.
 *
 * В prosemirror-inputrules таких нет — там только блочные. Регулярка обязана заканчиваться
 * на закрывающий ограничитель и содержать группу захвата с текстом без ограничителей;
 * ведущий символ (как `[^*]` у курсива) в захват не входит и остаётся на месте.
 */
function markInputRule(pattern: RegExp, markType: MarkType): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const content = match[match.length - 1];
    if (!content) return null;

    const full = match[0];
    const leading = full.search(/\S/);
    const textStart = start + full.indexOf(content);
    const textEnd = textStart + content.length;

    // Порядок важен: сначала выкусываем хвостовые ограничители, потом ведущие — иначе
    // вторая правка уедет по позициям после первой.
    const tr = state.tr;
    if (textEnd < end) tr.delete(textEnd, end);
    if (textStart > start) tr.delete(start + leading, textStart);

    const markFrom = start + leading;
    return tr
      .addMark(markFrom, markFrom + content.length, markType.create())
      .removeStoredMark(markType);
  });
}

function buildInputRules(schema: Schema): Plugin {
  const rules: InputRule[] = [...smartQuotes];

  rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));
  rules.push(
    wrappingInputRule(
      /^(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + (node.attrs.order as number) === Number(match[1]),
    ),
  );
  rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
  rules.push(textblockTypeInputRule(/^```$/, schema.nodes.code_block));
  rules.push(
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
      level: match[1].length,
    })),
  );

  // `---` на пустой строке — горизонтальная линия.
  rules.push(
    new InputRule(/^(?:---|___|\*\*\*)$/, (state, _match, start, end) =>
      state.tr.replaceRangeWith(start, end, schema.nodes.horizontal_rule.create()),
    ),
  );

  // `{{name}}`, набранный руками, — чип переменной прямо в тексте, зеркально правилу
  // парсера markdown. Без этого рула переменную никак не вставить в середину строки:
  // меню по «/» и «+» работают от блока, а плоский текст стал бы чипом только после
  // пересохранения документа.
  rules.push(
    new InputRule(/\{\{\s*([\w.]+)\s*\}\}$/, (state, match, start, end) =>
      state.tr.replaceRangeWith(start, end, schema.nodes.variable.create({ name: match[1] })),
    ),
  );

  rules.push(markInputRule(/(?:\*\*)([^*]+)(?:\*\*)$/, schema.marks.strong));
  rules.push(markInputRule(/(?:^|[^*])\*([^*]+)\*$/, schema.marks.em));
  rules.push(markInputRule(/(?:~~)([^~]+)(?:~~)$/, schema.marks.strike));
  rules.push(markInputRule(/(?:`)([^`]+)(?:`)$/, schema.marks.code));

  return inputRules({ rules });
}

function buildKeymap(schema: Schema): Record<string, Command> {
  const keys: Record<string, Command> = {
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
    Backspace: undoInputRule,

    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-u': toggleMark(schema.marks.underline),
    'Mod-Shift-x': toggleMark(schema.marks.strike),
    'Mod-Shift-h': toggleMark(schema.marks.highlight),
    'Mod-e': toggleMark(schema.marks.code),

    Enter: splitListItem(schema.nodes.list_item),
    Tab: chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item)),
    'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item)),

    'Mod-Shift-8': wrapInList(schema.nodes.bullet_list),
    'Mod-Shift-9': wrapInList(schema.nodes.ordered_list),
    'Mod-Shift-.': wrapIn(schema.nodes.blockquote),
    'Shift-Mod-\\': setBlockType(schema.nodes.code_block),
    'Shift-Mod-0': setBlockType(schema.nodes.paragraph),
  };

  for (let level = 1; level <= 6; level += 1) {
    keys[`Shift-Mod-${level}`] = setBlockType(schema.nodes.heading, { level });
  }

  // Перенос строки внутри абзаца и выход из код-блока — обе задачи на одном сочетании.
  const insertBreak = chainCommands(exitCode, (state, dispatch) => {
    dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
    return true;
  });
  keys['Shift-Enter'] = insertBreak;
  keys['Mod-Enter'] = insertBreak;

  return keys;
}

/**
 * Плейсхолдер пустого документа — node-декорация + CSS `::before`, НЕ виджет.
 *
 * `:empty` не работает (пустой параграф ProseMirror содержит `<br>`), а виджет со спаном
 * `contenteditable=false` ломал каретку: после «выделить всё → удалить» Chrome не мог
 * поставить курсор рядом с нередактируемым спаном, DOM-выделение пропадало целиком
 * (rangeCount 0), и любой ввод уходил в никуда до клика мышью.
 */
function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        const isEmpty =
          doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0;
        if (!isEmpty) return null;
        return DecorationSet.create(doc, [
          Decoration.node(0, doc.firstChild!.nodeSize, {
            class: 'k-editor-empty',
            'data-placeholder': text,
          }),
        ]);
      },
    },
  });
}

export function buildEditorPlugins({ placeholder = '' } = {}): Plugin[] {
  const plugins = [
    buildInputRules(editorSchema),
    keymap(buildKeymap(editorSchema)),
    keymap(baseKeymap),
    history(),
    dropCursor({ color: 'var(--color-primary)', width: 2 }),
    gapCursor(),
  ];
  if (placeholder) plugins.push(placeholderPlugin(placeholder));
  return plugins;
}
