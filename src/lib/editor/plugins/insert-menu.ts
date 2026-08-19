// Меню вставки блока.
//
// Один компонент на два входа — кнопку «+» у блока и «/» в пустом текстблоке. Разводить их
// на два меню было бы дублированием: набор пунктов и поведение одинаковы, различается
// только якорь и то, надо ли стирать набранный запрос.
//
// Состояние живёт в состоянии плагина, а не в замыкании view: так открытие меню — обычная
// транзакция (её умеет отправить и кнопка «+» из соседнего плагина), а запрос после «/»
// пересчитывается из документа, а не отслеживается вручную по событиям клавиатуры.
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  setParagraph,
  setCodeBlock,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
  insertHorizontalRule,
  insertTable,
  insertImage,
  insertVariable,
} from '../commands';
import { icons, headingIcon } from './icons';
import {
  createPopover,
  createMenuItem,
  createGroupLabel,
  place,
  rectAnchor,
  showPanel,
  hidePanel,
} from './dom';

export const insertMenuKey = new PluginKey<MenuState>('k-editor-insert-menu');

interface MenuState {
  open: boolean;
  /** Позиция «/», если меню открыто им; null — если открыто кнопкой «+». */
  slashFrom: number | null;
  query: string;
  active: number;
}

const CLOSED: MenuState = { open: false, slashFrom: null, query: '', active: 0 };

/**
 * Потолок высоты меню (совпадает с `max-height: 20rem` в стилях). Без него floating-ui
 * растягивает список на всю доступную высоту — меню из десятка пунктов занимает пол-экрана
 * и перекрывает документ, вместо того чтобы скроллиться.
 */
const MENU_MAX_HEIGHT = 320;

interface MenuEntry {
  label: string;
  icon: string;
  /** Дополнительные слова для поиска по «/» — сам label учитывается всегда. */
  keywords?: string[];
  command: Command;
}

function buildEntries(variables: string[]): MenuEntry[] {
  return [
    { label: 'Text', icon: icons.text, keywords: ['paragraph', 'plain'], command: setParagraph },
    { label: 'Heading 1', icon: headingIcon(1), keywords: ['h1', 'title'], command: toggleHeading(1) },
    { label: 'Heading 2', icon: headingIcon(2), keywords: ['h2'], command: toggleHeading(2) },
    { label: 'Heading 3', icon: headingIcon(3), keywords: ['h3'], command: toggleHeading(3) },
    { label: 'Bulleted list', icon: icons.bulletList, keywords: ['ul', 'bullet'], command: toggleBulletList },
    { label: 'Numbered list', icon: icons.orderedList, keywords: ['ol', 'ordered'], command: toggleOrderedList },
    { label: 'Quote', icon: icons.quote, keywords: ['blockquote'], command: toggleBlockquote },
    { label: 'Code block', icon: icons.codeBlock, keywords: ['pre', 'snippet'], command: setCodeBlock },
    { label: 'Table', icon: icons.table, keywords: ['grid'], command: insertTable(3, 3) },
    { label: 'Divider', icon: icons.hr, keywords: ['hr', 'rule', 'separator'], command: insertHorizontalRule },
    {
      label: 'Image',
      icon: icons.image,
      keywords: ['picture', 'photo'],
      // URL спрашиваем через prompt: диалог — забота потребителя, кит не должен тянуть в
      // себя модалку ради одного пункта. Загрузка файлом идёт другим путём (drop/paste).
      command: (state, dispatch, view) => {
        const src = window.prompt('Image URL');
        if (!src) return false;
        return insertImage(src)(state, dispatch, view);
      },
    },
    ...variables.map((name) => ({
      label: `{{${name}}}`,
      icon: icons.variable,
      keywords: ['variable', 'placeholder', name],
      command: insertVariable(name),
    })),
  ];
}

function matches(entry: MenuEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (entry.label.toLowerCase().includes(needle)) return true;
  return Boolean(entry.keywords?.some((word) => word.toLowerCase().includes(needle)));
}

/** Открыть меню без «/» — этим пользуется кнопка «+» у блока. */
export function openInsertMenu(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(insertMenuKey, { type: 'open', slashFrom: null }));
  view.focus();
}

/**
 * «/», только что набранный там, где он открывает меню: в начале текстблока или после
 * пробела — в том числе посреди строки. Внутри слова («и/или», URL) это обычный символ.
 *
 * Проверяем по результату транзакции, а не по событию ввода: текст до курсора кончается
 * на «/», а курсор сдвинулся ровно на один от прежней позиции — значит, символ появился
 * этим самым шагом, а не приехал с загруженным документом.
 */
function slashJustTyped(prev: EditorState, next: EditorState): number | null {
  const { $from, empty } = next.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  if ($from.parentOffset === 0) return null;

  // Лист-атомы (чипы переменных) в textBetween станут '\0' — не пробел, меню не откроется.
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');
  if (!textBefore.endsWith('/')) return null;
  const beforeSlash = textBefore.slice(0, -1);
  if (beforeSlash && !/[\s ]$/.test(beforeSlash)) return null;

  if (!prev.selection.empty || prev.selection.from !== $from.pos - 1) return null;
  return $from.pos - 1;
}

export function insertMenuPlugin({ variables = [] as string[] } = {}): Plugin {
  const entries = buildEntries(variables);
  const visibleEntries = (state: MenuState) => entries.filter((entry) => matches(entry, state.query));

  return new Plugin<MenuState>({
    key: insertMenuKey,

    state: {
      init: () => CLOSED,
      apply(tr, prev, _old, next) {
        const meta = tr.getMeta(insertMenuKey);
        if (meta?.type === 'close') return CLOSED;
        if (meta?.type === 'open') {
          return { open: true, slashFrom: meta.slashFrom ?? null, query: '', active: 0 };
        }
        if (meta?.type === 'active') return { ...prev, active: meta.active };
        if (!prev.open) return prev;

        // Меню, открытое кнопкой «+», живёт до явного закрытия: следить не за чем.
        if (prev.slashFrom === null) return prev;

        const slashFrom = tr.mapping.map(prev.slashFrom);
        const { from, empty } = next.selection;
        if (!empty || from <= slashFrom) return CLOSED;

        const text = next.doc.textBetween(slashFrom, from, '\n', '\n');
        if (!text.startsWith('/') || /\s/.test(text)) return CLOSED;

        const query = text.slice(1);
        return { ...prev, slashFrom, query, active: 0 };
      },
    },

    /** Автооткрытие по «/» — отдельной транзакцией сразу после той, что его вставила. */
    appendTransaction(_transactions, oldState, newState): Transaction | null {
      if (insertMenuKey.getState(newState)?.open) return null;
      const slashFrom = slashJustTyped(oldState, newState);
      if (slashFrom === null) return null;
      return newState.tr.setMeta(insertMenuKey, { type: 'open', slashFrom });
    },

    props: {
      handleKeyDown(view, event) {
        const state = insertMenuKey.getState(view.state);
        if (!state?.open) return false;
        const visible = visibleEntries(state);
        if (!visible.length) return false;

        if (event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta(insertMenuKey, { type: 'close' }));
          return true;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          const active = (state.active + delta + visible.length) % visible.length;
          view.dispatch(view.state.tr.setMeta(insertMenuKey, { type: 'active', active }));
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          applyEntry(view, visible[state.active]);
          return true;
        }
        return false;
      },
    },

    view(editorView) {
      const panel = createPopover('k-editor-menu');

      const render = (view: EditorView) => {
        const state = insertMenuKey.getState(view.state);
        if (!state?.open) {
          hidePanel(panel);
          return;
        }
        const visible = visibleEntries(state);
        if (!visible.length) {
          hidePanel(panel);
          return;
        }

        panel.replaceChildren(createGroupLabel(state.query ? `Insert · ${state.query}` : 'Insert'));
        visible.forEach((entry, index) => {
          const item = createMenuItem(entry.icon, entry.label, () => applyEntry(view, entry));
          if (index === state.active) item.dataset.active = 'true';
          panel.appendChild(item);
        });

        showPanel(panel);
        const coords = view.coordsAtPos(view.state.selection.from);
        void place(rectAnchor(coords), panel, 'bottom', MENU_MAX_HEIGHT);
      };

      const onDocumentMouseDown = (event: MouseEvent) => {
        if (!insertMenuKey.getState(editorView.state)?.open) return;
        if (panel.contains(event.target as Node)) return;
        editorView.dispatch(editorView.state.tr.setMeta(insertMenuKey, { type: 'close' }));
      };
      document.addEventListener('mousedown', onDocumentMouseDown);

      render(editorView);

      return {
        update: render,
        destroy() {
          document.removeEventListener('mousedown', onDocumentMouseDown);
          panel.remove();
        },
      };
    },
  });
}

/** Стереть «/запрос» (если он был), закрыть меню и выполнить команду пункта. */
function applyEntry(view: EditorView, entry: MenuEntry): void {
  const state = insertMenuKey.getState(view.state);
  const tr = view.state.tr.setMeta(insertMenuKey, { type: 'close' });

  if (state?.slashFrom != null) {
    const to = Math.min(state.slashFrom + 1 + state.query.length, view.state.doc.content.size);
    tr.delete(state.slashFrom, to);
    tr.setSelection(TextSelection.create(tr.doc, state.slashFrom));
  }
  view.dispatch(tr);

  entry.command(view.state, view.dispatch, view);
  view.focus();
}
