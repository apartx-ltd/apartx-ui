// Ручки блока: ⠿ (перетащить) и + (вставить), появляются слева по ховеру.
//
// Ручки лежат внутри редактора, а не в body: они позиционируются относительно блока и
// должны ездить вместе с ним при скролле. Обрезка тут не грозит — они у левого края
// содержимого, под которое в .k-editor оставлен отступ.
import { Plugin, NodeSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { editorSchema } from '../schema';
import { icons } from './icons';
import { openInsertMenu } from './insert-menu';

/** Позиция блока верхнего уровня под координатами курсора. */
function topLevelBlockAt(view: EditorView, x: number, y: number): { pos: number; dom: HTMLElement } | null {
  const found = view.posAtCoords({ left: x, top: y });
  if (!found) return null;

  // Поднимаемся к глубине 1 — прямому ребёнку doc. Глубже не лезем: таскать отдельный
  // пункт списка из-под его родителя — источник битых документов, а не удобство.
  //
  // Резолвить надо found.pos, а не found.inside: inside указывает НА позицию перед узлом,
  // и `resolve` на ней даёт глубину родителя, из-за чего before(1) промахивается мимо
  // блока. Для атомарных блоков верхнего уровня (линия, картинка) внутренней позиции нет —
  // там как раз и берём inside.
  const $pos = view.state.doc.resolve(found.pos);
  const pos = $pos.depth > 0 ? $pos.before(1) : found.inside;
  if (pos < 0) return null;

  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;
  return { pos, dom };
}

export function blockHandlePlugin(): Plugin {
  return new Plugin({
    view(editorView) {
      const handles = document.createElement('div');
      handles.className = 'k-editor-handles';
      handles.contentEditable = 'false';

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'k-editor-handle k-editor-handle--add';
      addButton.title = 'Insert block';
      addButton.setAttribute('aria-label', 'Insert block');
      addButton.innerHTML = icons.plus;

      const dragButton = document.createElement('button');
      dragButton.type = 'button';
      dragButton.className = 'k-editor-handle';
      dragButton.title = 'Drag block';
      dragButton.setAttribute('aria-label', 'Drag block');
      dragButton.innerHTML = icons.drag;
      dragButton.draggable = true;

      handles.append(addButton, dragButton);
      editorView.dom.parentElement?.appendChild(handles);

      /** Блок, к которому сейчас привязаны ручки. */
      let target: number | null = null;

      const hide = () => {
        handles.dataset.visible = 'false';
        target = null;
      };

      const showFor = (pos: number, dom: HTMLElement) => {
        target = pos;
        const host = editorView.dom.parentElement;
        if (!host) return;
        const hostRect = host.getBoundingClientRect();
        const rect = dom.getBoundingClientRect();
        handles.dataset.visible = 'true';
        handles.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
        handles.style.left = `${rect.left - hostRect.left - handles.offsetWidth - 2}px`;
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!editorView.editable) return hide();
        if (handles.contains(event.target as Node)) return;
        const found = topLevelBlockAt(editorView, event.clientX, event.clientY);
        if (!found) return hide();
        showFor(found.pos, found.dom);
      };

      const onMouseLeave = (event: MouseEvent) => {
        // Уход курсора на сами ручки не считается уходом с блока.
        if (handles.contains(event.relatedTarget as Node)) return;
        hide();
      };

      editorView.dom.addEventListener('mousemove', onMouseMove);
      editorView.dom.addEventListener('mouseleave', onMouseLeave);
      handles.addEventListener('mouseleave', onMouseLeave);

      addButton.addEventListener('click', () => {
        if (target === null) return;
        const node = editorView.state.doc.nodeAt(target);
        if (!node) return;

        // Заводим ПУСТОЙ абзац под блоком и ставим курсор в него, а уже потом открываем
        // меню. Нодовое выделение самого блока тут не годится: команды вставки работают
        // через replaceSelection, и выбранный пункт затёр бы блок, на который навели, —
        // «+» обязана добавлять, а не заменять.
        const after = target + node.nodeSize;
        const paragraph = editorSchema.nodes.paragraph.createAndFill();
        if (!paragraph) return;

        const tr = editorView.state.tr.insert(after, paragraph);
        tr.setSelection(TextSelection.create(tr.doc, after + 1));
        editorView.dispatch(tr.scrollIntoView());
        openInsertMenu(editorView);
      });

      // Перетаскивание: выделяем блок нодовым выделением и отдаём ProseMirror'у его же
      // механику drag&drop — она сама покажет dropcursor и перенесёт узел.
      dragButton.addEventListener('dragstart', (event) => {
        if (target === null || !event.dataTransfer) return;
        const selection = NodeSelection.create(editorView.state.doc, target);
        editorView.dispatch(editorView.state.tr.setSelection(selection));

        const slice = selection.content();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', '');
        editorView.dragging = { slice, move: true };
      });

      dragButton.addEventListener('dragend', () => {
        editorView.dragging = null;
      });

      return {
        update() {
          // Документ поменялся — привязка к позиции могла устареть; ручки покажет
          // следующее движение мыши.
          hide();
        },
        destroy() {
          editorView.dom.removeEventListener('mousemove', onMouseMove);
          editorView.dom.removeEventListener('mouseleave', onMouseLeave);
          handles.remove();
        },
      };
    },
  });
}
