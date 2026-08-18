// Картинки файлом: drop в редактор и вставка из буфера.
//
// Без хука загрузки плагин молчит и пропускает событие дальше: класть в документ blob-URL
// нельзя — он живёт до перезагрузки вкладки, а в markdown уедет ссылкой, которая назавтра
// никуда не ведёт. Кит не знает, куда потребитель грузит файлы, поэтому это его хук.
import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { editorSchema } from '../schema';

type UploadHandler = ((file: File) => Promise<string>) | null;

const imageFiles = (list: FileList | null | undefined): File[] =>
  Array.from(list ?? []).filter((file) => file.type.startsWith('image/'));

async function insertUploaded(view: EditorView, files: File[], upload: (f: File) => Promise<string>, pos: number) {
  for (const file of files) {
    const src = await upload(file);
    if (!src) continue;
    const node = editorSchema.nodes.image.create({ src, alt: file.name });
    // Позицию пересчитываем от актуального состояния: пока грузился файл, документ мог
    // измениться, и сохранённая позиция уже не та.
    const at = Math.min(pos, view.state.doc.content.size);
    view.dispatch(view.state.tr.insert(at, node).scrollIntoView());
  }
}

export function imageDropPlugin({ onUploadImage = null as UploadHandler } = {}): Plugin {
  return new Plugin({
    props: {
      handleDrop(view, event) {
        if (!onUploadImage) return false;
        const dragEvent = event as DragEvent;
        const files = imageFiles(dragEvent.dataTransfer?.files);
        if (!files.length) return false;

        const coords = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY });
        void insertUploaded(view, files, onUploadImage, coords?.pos ?? view.state.selection.from);
        return true;
      },

      handlePaste(view, event) {
        if (!onUploadImage) return false;
        const files = imageFiles((event as ClipboardEvent).clipboardData?.files);
        if (!files.length) return false;

        void insertUploaded(view, files, onUploadImage, view.state.selection.from);
        return true;
      },
    },
  });
}
