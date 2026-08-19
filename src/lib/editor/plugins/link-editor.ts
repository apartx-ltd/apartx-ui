// Попап ссылки: поставить, изменить, убрать, открыть.
//
// Открывается кнопкой тулбара (через openLinkEditor) и кликом по существующей ссылке.
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { applyLink, removeLink } from '../commands';
import { editorSchema } from '../schema';
import { icons } from './icons';
import { createPopover, createButton, place, rectAnchor, showPanel, hidePanel } from './dom';

export const linkEditorKey = new PluginKey<LinkState>('k-editor-link');

interface LinkState {
  open: boolean;
  href: string;
  /** Диапазон существующей ссылки — чтобы «убрать» работал и без выделения. */
  from: number;
  to: number;
}

const CLOSED: LinkState = { open: false, href: '', from: 0, to: 0 };

/** Границы ссылки под позицией — ProseMirror сам такого не даёт. */
function linkRangeAt(view: EditorView, pos: number): { href: string; from: number; to: number } | null {
  const $pos = view.state.doc.resolve(pos);
  const mark = editorSchema.marks.link.isInSet($pos.marks());
  if (!mark) return null;

  const parent = $pos.parent;
  const start = $pos.pos - $pos.parentOffset;
  let from = start;
  let to = start;
  parent.forEach((child, offset) => {
    if (!editorSchema.marks.link.isInSet(child.marks)) return;
    const childFrom = start + offset;
    const childTo = childFrom + child.nodeSize;
    if (childFrom <= pos && pos <= childTo) {
      from = childFrom;
      to = childTo;
    }
  });
  return { href: mark.attrs.href as string, from, to };
}

export function openLinkEditor(view: EditorView): void {
  const { from, to } = view.state.selection;
  const existing = linkRangeAt(view, from);
  view.dispatch(
    view.state.tr.setMeta(linkEditorKey, {
      type: 'open',
      href: existing?.href ?? '',
      from: existing?.from ?? from,
      to: existing?.to ?? to,
    }),
  );
}

export function linkEditorPlugin(): Plugin {
  return new Plugin<LinkState>({
    key: linkEditorKey,

    state: {
      init: () => CLOSED,
      apply(tr, prev) {
        const meta = tr.getMeta(linkEditorKey);
        if (meta?.type === 'close') return CLOSED;
        if (meta?.type === 'open') {
          return { open: true, href: meta.href, from: meta.from, to: meta.to };
        }
        if (!prev.open) return prev;
        // Документ поменялся не нами — попап закрываем, его позиции больше не верны.
        return tr.docChanged ? CLOSED : prev;
      },
    },

    props: {
      handleClick(view, pos) {
        const existing = linkRangeAt(view, pos);
        if (!existing) return false;
        view.dispatch(
          view.state.tr.setMeta(linkEditorKey, { type: 'open', ...existing }),
        );
        return false;
      },
    },

    view(editorView) {
      const panel = createPopover();
      const input = document.createElement('input');
      input.type = 'url';
      input.className = 'k-editor-input';
      input.placeholder = 'https://…';

      const close = (view: EditorView) => {
        view.dispatch(view.state.tr.setMeta(linkEditorKey, { type: 'close' }));
        view.focus();
      };

      const submit = (view: EditorView) => {
        const state = linkEditorKey.getState(view.state);
        const href = input.value.trim();
        if (!href) return;
        const tr = view.state.tr.setMeta(linkEditorKey, { type: 'close' });
        // Выделение восстанавливаем по сохранённому диапазону: клик по ссылке не выделяет
        // её, а команде нужен диапазон, к которому применять марку.
        if (state && state.from !== state.to) {
          tr.setSelection(TextSelection.create(tr.doc, state.from, state.to));
        }
        view.dispatch(tr);
        applyLink(href)(view.state, view.dispatch, view);
        view.focus();
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit(editorView);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          close(editorView);
        }
      });

      panel.append(
        input,
        createButton({ icon: icons.check, title: 'Apply', onClick: () => submit(editorView) }),
        createButton({
          icon: icons.open,
          title: 'Open link',
          onClick: () => {
            const href = input.value.trim();
            if (href) window.open(href, '_blank', 'noopener,noreferrer');
          },
        }),
        createButton({
          icon: icons.unlink,
          title: 'Remove link',
          onClick: () => {
            const state = linkEditorKey.getState(editorView.state);
            const tr = editorView.state.tr.setMeta(linkEditorKey, { type: 'close' });
            if (state && state.from !== state.to) {
              tr.removeMark(state.from, state.to, editorSchema.marks.link);
            }
            editorView.dispatch(tr);
            removeLink(editorView.state, editorView.dispatch, editorView);
            editorView.focus();
          },
        }),
      );
      // Ввод в поле требует фокуса — общий запрет на увод фокуса тут мешает.
      input.addEventListener('mousedown', (event) => event.stopPropagation());

      const render = (view: EditorView) => {
        const state = linkEditorKey.getState(view.state);
        if (!state?.open) {
          hidePanel(panel);
          return;
        }
        input.value = state.href;
        showPanel(panel);
        void place(rectAnchor(view.coordsAtPos(state.from)), panel, 'top');
        input.focus();
        input.select();
      };

      render(editorView);
      return { update: render, destroy: () => panel.remove() };
    },
  });
}
