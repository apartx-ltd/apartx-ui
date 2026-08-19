<script>
  /**
   * WYSIWYG-редактор над markdown на ProseMirror.
   *
   * Контракт содержимого — pull, а не push: `value` читается ОДИН раз при маунте, дальше
   * документом владеет редактор, а родитель забирает его через `getMarkdown()` в момент,
   * когда сохраняет. Пуш-колбэк на каждое изменение здесь был бы ловушкой: у редакторов
   * такие уведомления приходят с задержкой, и «напечатал → сразу Save» уезжает на сервер
   * с пустым телом.
   *
   * Смена документа под тем же компонентом — забота родителя: обернуть в `{#key id}`,
   * чтобы редактор пересоздался.
   */
  import { onMount, onDestroy } from 'svelte';
  import { EditorState } from 'prosemirror-state';
  import { EditorView } from 'prosemirror-view';
  import { columnResizing, tableEditing } from 'prosemirror-tables';
  import { editorSchema } from './schema';
  import { parseMarkdown, serializeMarkdown } from './markdown';
  import { buildEditorPlugins } from './setup';
  import { markdownPastePlugin } from './plugins/paste';
  import { selectionToolbarPlugin } from './plugins/selection-toolbar';
  import { blockHandlePlugin } from './plugins/block-handle';
  import { insertMenuPlugin } from './plugins/insert-menu';
  import { linkEditorPlugin } from './plugins/link-editor';
  import { imageEditorPlugin } from './plugins/image-editor';
  import { imageDropPlugin } from './plugins/image-drop';

  let {
    value = '',
    readonly = false,
    placeholder = '',
    variables = [],
    onUploadImage = null,
    onChange = null,
    class: className = '',
    ...rest
  } = $props();

  let host = $state(null);
  let view = null;

  /**
   * Текущее содержимое в markdown. До создания view — то, с чем компонент смонтировали:
   * сохранение на неинициализированном редакторе не должно стирать документ.
   */
  export function getMarkdown() {
    if (!view) return value;
    return serializeMarkdown(view.state.doc);
  }

  /** Программная вставка чипа переменной в позицию курсора. */
  export function insertVariable(name) {
    if (!view || !name) return;
    const { variable } = editorSchema.nodes;
    view.dispatch(view.state.tr.replaceSelectionWith(variable.create({ name })).scrollIntoView());
    view.focus();
  }

  /** Доступ к view для тулбаров — они живут снаружи компонента. */
  export function getView() {
    return view;
  }

  export function focus() {
    view?.focus();
  }

  onMount(() => {
    const state = EditorState.create({
      doc: parseMarkdown(value),
      plugins: [
        // Меню вставки идёт ПЕРВЫМ намеренно: ProseMirror опрашивает handleKeyDown в
        // порядке плагинов, и, стоя после keymap'ов, меню не увидит ни Enter, ни стрелки —
        // Enter уйдёт в splitListItem вместо выбора пункта.
        insertMenuPlugin({ variables }),
        ...buildEditorPlugins({ placeholder }),
        markdownPastePlugin(),
        imageDropPlugin({ onUploadImage }),
        // columnResizing до tableEditing — так требует prosemirror-tables.
        columnResizing({}),
        tableEditing(),
        selectionToolbarPlugin(),
        blockHandlePlugin(),
        linkEditorPlugin(),
        imageEditorPlugin({ onUploadImage }),
      ],
    });

    view = new EditorView(host, {
      state,
      editable: () => !readonly,
      dispatchTransaction(transaction) {
        const next = view.state.apply(transaction);
        view.updateState(next);
        if (transaction.docChanged) onChange?.();
      },
    });
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });

  // readonly меняется пропом — пересоздавать редактор ради этого не нужно, достаточно
  // пересчитать props: `editable` читает актуальное значение через замыкание.
  $effect(() => {
    void readonly;
    view?.setProps({ editable: () => !readonly });
  });
</script>

<div bind:this={host} class={`k-editor ${className}`} {...rest}></div>
