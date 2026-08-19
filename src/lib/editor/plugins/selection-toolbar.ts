// Плавающий тулбар по выделению (bubble).
//
// Появляется, когда есть непустое текстовое выделение, и прячется во всех остальных
// случаях. Внутри таблицы к обычным кнопкам добавляется блок табличных действий — иначе
// строки и столбцы нечем добавить, кроме как из меню вставки заново.
import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  isMarkActive,
  isBlockActive,
  isInList,
  isInTable,
  toggleStrong,
  toggleEm,
  toggleUnderline,
  toggleStrike,
  toggleHighlight,
  toggleCode,
  toggleHeading,
  setParagraph,
  setCodeBlock,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
  tableCommands,
  run,
} from '../commands';
import { editorSchema } from '../schema';
import { icons, headingIcon } from './icons';
import { openLinkEditor } from './link-editor';
import {
  createPopover,
  createButton,
  createSeparator,
  place,
  rectAnchor,
  showPanel,
  hidePanel,
  refreshButtons,
  type ButtonSpec,
} from './dom';

const { marks, nodes } = editorSchema;

function buildSpecs(view: () => EditorView | null): ButtonSpec[] {
  const state = () => view()?.state ?? null;
  const cmd = (command: Parameters<typeof run>[1]) => () => run(view(), command);

  return [
    { icon: icons.bold, title: 'Bold', onClick: cmd(toggleStrong), active: () => Boolean(state() && isMarkActive(state()!, marks.strong)) },
    { icon: icons.italic, title: 'Italic', onClick: cmd(toggleEm), active: () => Boolean(state() && isMarkActive(state()!, marks.em)) },
    { icon: icons.underline, title: 'Underline', onClick: cmd(toggleUnderline), active: () => Boolean(state() && isMarkActive(state()!, marks.underline)) },
    { icon: icons.highlight, title: 'Highlight', onClick: cmd(toggleHighlight), active: () => Boolean(state() && isMarkActive(state()!, marks.highlight)) },
    { icon: icons.strike, title: 'Strikethrough', onClick: cmd(toggleStrike), active: () => Boolean(state() && isMarkActive(state()!, marks.strike)) },
    { icon: 'sep', title: '', onClick: () => {} },
    { icon: icons.bulletList, title: 'Bulleted list', onClick: cmd(toggleBulletList), active: () => Boolean(state() && isInList(state()!, nodes.bullet_list)) },
    { icon: icons.orderedList, title: 'Numbered list', onClick: cmd(toggleOrderedList), active: () => Boolean(state() && isInList(state()!, nodes.ordered_list)) },
    { icon: icons.quote, title: 'Quote', onClick: cmd(toggleBlockquote) },
    { icon: 'sep', title: '', onClick: () => {} },
    { icon: icons.text, title: 'Paragraph', onClick: cmd(setParagraph), active: () => Boolean(state() && isBlockActive(state()!, nodes.paragraph)) },
    ...[1, 2, 3].map((level) => ({
      icon: headingIcon(level),
      title: `Heading ${level}`,
      onClick: cmd(toggleHeading(level)),
      active: () => Boolean(state() && isBlockActive(state()!, nodes.heading, { level })),
    })),
    { icon: 'sep', title: '', onClick: () => {} },
    { icon: icons.code, title: 'Inline code', onClick: cmd(toggleCode), active: () => Boolean(state() && isMarkActive(state()!, marks.code)) },
    { icon: icons.codeBlock, title: 'Code block', onClick: cmd(setCodeBlock), active: () => Boolean(state() && isBlockActive(state()!, nodes.code_block)) },
  ];
}

/** Табличные действия — отдельной секцией, видимой только когда курсор в таблице. */
function buildTableSpecs(view: () => EditorView | null): ButtonSpec[] {
  const cmd = (command: Parameters<typeof run>[1]) => () => run(view(), command);
  return [
    { icon: icons.rowAfter, title: 'Insert row below', onClick: cmd(tableCommands.addRowAfter) },
    { icon: icons.colAfter, title: 'Insert column after', onClick: cmd(tableCommands.addColumnAfter) },
    { icon: icons.trash, title: 'Delete row', onClick: cmd(tableCommands.deleteRow) },
  ];
}

export function selectionToolbarPlugin(): Plugin {
  return new Plugin({
    view(editorView) {
      let view: EditorView | null = editorView;
      const panel = createPopover();
      const linkButton = createButton({
        icon: icons.link,
        title: 'Link',
        // Попап ссылки живёт в своём плагине и открывается транзакцией — тулбару не нужно
        // знать ни про его DOM, ни про его состояние.
        onClick: () => view && openLinkEditor(view),
      });

      const specs = buildSpecs(() => view);
      const buttons: Array<[HTMLButtonElement, ButtonSpec]> = [];
      for (const spec of specs) {
        if (spec.icon === 'sep') {
          panel.appendChild(createSeparator());
          continue;
        }
        const button = createButton(spec);
        panel.appendChild(button);
        buttons.push([button, spec]);
      }
      panel.appendChild(createSeparator());
      panel.appendChild(linkButton);

      const tableSection = document.createElement('div');
      tableSection.style.display = 'none';
      tableSection.append(createSeparator(), ...buildTableSpecs(() => view).map(createButton));
      tableSection.style.alignItems = 'center';
      tableSection.style.gap = '0.125rem';
      panel.appendChild(tableSection);

      const update = (current: EditorView) => {
        view = current;
        const { state } = current;
        const { empty, from, to } = state.selection;
        const hasFocus = current.hasFocus();

        if (empty || !hasFocus || !current.editable) {
          hidePanel(panel);
          return;
        }

        refreshButtons(buttons);
        tableSection.style.display = isInTable(state) ? 'flex' : 'none';
        showPanel(panel);

        const start = current.coordsAtPos(from);
        const end = current.coordsAtPos(to);
        void place(
          rectAnchor({
            left: Math.min(start.left, end.left),
            right: Math.max(start.right, end.right),
            top: Math.min(start.top, end.top),
            bottom: Math.max(start.bottom, end.bottom),
          }),
          panel,
          'top',
        );
      };

      update(editorView);

      return {
        update,
        destroy() {
          panel.remove();
          view = null;
        },
      };
    },
  });
}
