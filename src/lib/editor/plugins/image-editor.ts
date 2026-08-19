// Попап картинки: вставить (URL, файл с диска, дроп) и поправить src/alt/title существующей.
//
// Один попап на оба входа: пункт Image меню вставки открывает его пустым (openImageEditor),
// клик по картинке в документе — заполненным её атрибутами. Загрузка файлом доступна
// только при заданном onUploadImage — это тот же хук потребителя, что у drop/paste прямо
// в документ (imageDropPlugin): кит не знает, куда потребитель грузит файлы, и без хука
// честно предлагает только URL.
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { insertImage } from '../commands';
import { editorSchema } from '../schema';
import { icons } from './icons';
import {
  createPopover,
  createMenuItem,
  createGroupLabel,
  place,
  rectAnchor,
  showPanel,
  hidePanel,
} from './dom';

export const imageEditorKey = new PluginKey<ImageEditorState>('k-editor-image');

interface ImageEditorState {
  open: boolean;
  /** Позиция существующей ноды image; null — вставка новой в текущее выделение. */
  pos: number | null;
}

const CLOSED: ImageEditorState = { open: false, pos: null };

type UploadHandler = ((file: File) => Promise<string>) | null;

/** Открыть попап в режиме вставки — этим пользуется пункт Image меню вставки. */
export function openImageEditor(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(imageEditorKey, { type: 'open', pos: null }));
}

function createField(type: string, placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.className = 'k-editor-input';
  input.placeholder = placeholder;
  return input;
}

export function imageEditorPlugin({ onUploadImage = null as UploadHandler } = {}): Plugin {
  return new Plugin<ImageEditorState>({
    key: imageEditorKey,

    state: {
      init: () => CLOSED,
      apply(tr, prev) {
        const meta = tr.getMeta(imageEditorKey);
        if (meta?.type === 'close') return CLOSED;
        if (meta?.type === 'open') return { open: true, pos: meta.pos ?? null };
        if (!prev.open) return prev;
        // Документ поменялся не нами (свои правки закрывают попап той же транзакцией) —
        // сохранённая позиция ноды больше не достоверна.
        return tr.docChanged ? CLOSED : prev;
      },
    },

    props: {
      handleClickOn(view, _pos, node, nodePos) {
        if (node.type !== editorSchema.nodes.image) return false;
        view.dispatch(view.state.tr.setMeta(imageEditorKey, { type: 'open', pos: nodePos }));
        return false;
      },
    },

    view(editorView) {
      const panel = createPopover('k-editor-image-form');
      const srcInput = createField('url', 'https://…');
      const altInput = createField('text', 'Alt text');
      const titleInput = createField('text', 'Title');

      const apply = () => {
        const src = srcInput.value.trim();
        if (!src) return;
        const state = imageEditorKey.getState(editorView.state);
        const tr = editorView.state.tr.setMeta(imageEditorKey, { type: 'close' });

        const existing =
          state?.pos != null ? editorView.state.doc.nodeAt(state.pos) : null;
        if (state?.pos != null && existing?.type === editorSchema.nodes.image) {
          tr.setNodeMarkup(state.pos, null, {
            src,
            alt: altInput.value.trim() || null,
            title: titleInput.value.trim() || null,
          });
          editorView.dispatch(tr);
          editorView.focus();
          return;
        }

        editorView.dispatch(tr);
        insertImage(src, altInput.value.trim(), titleInput.value.trim())(
          editorView.state,
          editorView.dispatch,
          editorView,
        );
        editorView.focus();
      };

      const close = () => {
        editorView.dispatch(editorView.state.tr.setMeta(imageEditorKey, { type: 'close' }));
        editorView.focus();
      };

      for (const input of [srcInput, altInput, titleInput]) {
        // Ввод в поле требует фокуса — общий запрет попапа на увод фокуса тут мешает.
        input.addEventListener('mousedown', (event) => event.stopPropagation());
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          }
        });
      }

      panel.append(createGroupLabel('Image'), srcInput, altInput, titleInput);

      if (onUploadImage) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const uploadFile = async (file: File) => {
          panel.dataset.uploading = 'true';
          try {
            const src = await onUploadImage(file);
            if (!src) return;
            srcInput.value = src;
            if (!altInput.value.trim()) altInput.value = file.name;
            apply();
          } finally {
            delete panel.dataset.uploading;
          }
        };

        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          fileInput.value = '';
          if (file) void uploadFile(file);
        });

        // Дроп-зона — весь попап: отдельная рамка на 19rem ширины была бы бутафорией.
        panel.addEventListener('dragover', (event) => {
          event.preventDefault();
          panel.dataset.drag = 'true';
        });
        panel.addEventListener('dragleave', () => {
          delete panel.dataset.drag;
        });
        panel.addEventListener('drop', (event) => {
          event.preventDefault();
          delete panel.dataset.drag;
          const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
            f.type.startsWith('image/'),
          );
          if (file) void uploadFile(file);
        });

        panel.append(
          createMenuItem(icons.upload, 'Upload — or drop a file here', () => fileInput.click()),
          fileInput,
        );
      }

      panel.appendChild(createMenuItem(icons.check, 'Apply', apply));

      const onDocumentMouseDown = (event: MouseEvent) => {
        if (!imageEditorKey.getState(editorView.state)?.open) return;
        if (panel.contains(event.target as Node)) return;
        editorView.dispatch(editorView.state.tr.setMeta(imageEditorKey, { type: 'close' }));
      };
      document.addEventListener('mousedown', onDocumentMouseDown);

      // Поля заполняются один раз при открытии, а не на каждый update: пока попап открыт,
      // update прилетает и от смены выделения, и перезапись стёрла бы набранное.
      let openedFor: string | null = null;

      const render = (view: EditorView) => {
        const state = imageEditorKey.getState(view.state);
        if (!state?.open) {
          hidePanel(panel);
          openedFor = null;
          return;
        }

        showPanel(panel);
        const key = state.pos == null ? 'insert' : String(state.pos);
        if (openedFor !== key) {
          openedFor = key;
          const node = state.pos != null ? view.state.doc.nodeAt(state.pos) : null;
          srcInput.value = (node?.attrs.src as string) ?? '';
          altInput.value = (node?.attrs.alt as string) ?? '';
          titleInput.value = (node?.attrs.title as string) ?? '';
          // Фокус — после showPanel: скрытый display:none инпут фокус не принимает.
          srcInput.focus();
          srcInput.select();
        }
        const nodeDom = state.pos != null ? (view.nodeDOM(state.pos) as HTMLElement | null) : null;
        const anchor = nodeDom ?? rectAnchor(view.coordsAtPos(view.state.selection.from));
        void place(anchor, panel, 'bottom');
      };

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
