<script>
  /**
   * Статичный тулбар редактора.
   *
   * Живёт отдельным компонентом, а не внутри `<Editor>`: потребитель сам решает, ставить
   * его сверху или снизу, и что положить в `actions` — у Asana в этом месте «Create task»,
   * у кабинета будет своё. Связь с редактором — через `view`, который отдаёт
   * `editor.getView()`.
   *
   * Подписи — пропы с английскими значениями по умолчанию: перевод делается на месте
   * вызова, кит про i18n не знает.
   */
  import {
    isMarkActive,
    isBlockActive,
    isInList,
    toggleStrong,
    toggleEm,
    toggleUnderline,
    toggleStrike,
    toggleHighlight,
    toggleCode,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    insertHorizontalRule,
    insertTable,
    run,
  } from './commands';
  import { editorSchema } from './schema';
  import { icons } from './plugins/icons';
  import { openLinkEditor } from './plugins/link-editor';
  import { openInsertMenu } from './plugins/insert-menu';
  import { undo, redo } from 'prosemirror-history';

  let {
    view = null,
    position = 'bottom',
    // Прилипать к верху скролл-контейнера. Имеет смысл только с position="top": длинный
    // документ прокручивается, а кнопки остаются под рукой.
    sticky = false,
    labels = {},
    actions = null,
    class: className = '',
    ...rest
  } = $props();

  const text = $derived({
    undo: 'Undo',
    redo: 'Redo',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    highlight: 'Highlight',
    strike: 'Strikethrough',
    code: 'Inline code',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    quote: 'Quote',
    link: 'Link',
    table: 'Insert table',
    divider: 'Divider',
    insert: 'Insert block',
    ...labels,
  });

  const { marks, nodes } = editorSchema;

  // Пересчёт нажатости привязан к версии документа/селекции: сам по себе `view.state`
  // не реактивен, поэтому родитель дёргает `refresh()` из onChange редактора, а мы
  // считаем всё заново по требованию.
  let tick = $state(0);
  export function refresh() {
    tick += 1;
  }

  const state = $derived.by(() => {
    void tick;
    return view?.state ?? null;
  });

  const markOn = (mark) => Boolean(state && isMarkActive(state, mark));
  const listOn = (node) => Boolean(state && isInList(state, node));

  const groups = $derived([
    [
      { icon: icons.undo, title: text.undo, cmd: undo },
      { icon: icons.redo, title: text.redo, cmd: redo },
    ],
    [
      { icon: icons.bold, title: text.bold, cmd: toggleStrong, on: markOn(marks.strong) },
      { icon: icons.italic, title: text.italic, cmd: toggleEm, on: markOn(marks.em) },
      { icon: icons.underline, title: text.underline, cmd: toggleUnderline, on: markOn(marks.underline) },
      { icon: icons.highlight, title: text.highlight, cmd: toggleHighlight, on: markOn(marks.highlight) },
      { icon: icons.strike, title: text.strike, cmd: toggleStrike, on: markOn(marks.strike) },
      { icon: icons.code, title: text.code, cmd: toggleCode, on: markOn(marks.code) },
    ],
    [
      { icon: icons.bulletList, title: text.bulletList, cmd: toggleBulletList, on: listOn(nodes.bullet_list) },
      { icon: icons.orderedList, title: text.orderedList, cmd: toggleOrderedList, on: listOn(nodes.ordered_list) },
      { icon: icons.quote, title: text.quote, cmd: toggleBlockquote, on: Boolean(state && isBlockActive(state, nodes.blockquote)) },
    ],
    [
      { icon: icons.table, title: text.table, cmd: insertTable(3, 3) },
      { icon: icons.hr, title: text.divider, cmd: insertHorizontalRule },
    ],
  ]);
</script>

<div
  class={`k-editor-toolbar ${position === 'bottom' ? 'k-editor-toolbar--bottom' : ''} ${sticky ? 'k-editor-toolbar--sticky' : ''} ${className}`}
  {...rest}
>
  <button
    type="button"
    class="k-editor-btn"
    title={text.insert}
    aria-label={text.insert}
    onclick={() => view && openInsertMenu(view)}
  >
    {@html icons.plus}
  </button>
  <div class="k-editor-sep"></div>

  {#each groups as group, index (index)}
    {#each group as item (item.title)}
      <button
        type="button"
        class="k-editor-btn"
        title={item.title}
        aria-label={item.title}
        aria-pressed={item.on ? 'true' : 'false'}
        onclick={() => {
          run(view, item.cmd);
          refresh();
        }}
      >
        {@html item.icon}
      </button>
    {/each}
    <div class="k-editor-sep"></div>
  {/each}

  <button
    type="button"
    class="k-editor-btn"
    title={text.link}
    aria-label={text.link}
    onclick={() => view && openLinkEditor(view)}
  >
    {@html icons.link}
  </button>

  {#if actions}
    <div class="k-editor-sep"></div>
    {@render actions()}
  {/if}
</div>
