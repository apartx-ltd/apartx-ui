<script lang="ts">
  // Полигон редактора: набор фич, ручная проверка round-trip и вставки.
  import { Editor, EditorToolbar } from '$lib/editor';

  const DEMO = [
    '# Договор {{brand.legalName}}',
    '',
    'Вводный абзац со **значимым** словом, *курсивом*, <u>подчёркиванием</u> и',
    '<mark>маркером</mark>. Ссылка на [сайт](https://example.com).',
    '',
    '## Условия',
    '',
    '- первое условие',
    '- второе условие',
    '  - вложенное уточнение',
    '',
    '1. шаг один',
    '2. шаг два',
    '',
    '| Услуга | Цена | Примечание |',
    '| --- | --- | --- |',
    '| Уборка | 5000 | раз в неделю |',
    '| Стирка | 2000 | по запросу |',
    '',
    '> Примечание: {{appName}} оставляет за собой право изменить тариф.',
    '',
    '```ts',
    "const total = items.reduce((sum, item) => sum + item.price, 0);",
    '```',
    '',
    '---',
  ].join('\n');

  let editor = $state<any>(null);
  let toolbar = $state<any>(null);
  let output = $state('');

  const variables = ['appName', 'supportEmail', 'brand.legalName'];
</script>

<div class="mx-auto flex max-w-4xl flex-col gap-4 p-4">
  <header class="flex flex-col gap-1">
    <h1 class="text-2xl font-semibold">Editor</h1>
    <p class="text-on-surface-variant text-sm">
      WYSIWYG над markdown. Выделите текст — появится плавающая панель; наведите на блок —
      слева появятся ⠿ и +; наберите «/» в пустом абзаце — откроется меню вставки.
    </p>
  </header>

  <div class="flex flex-col">
    <Editor
      bind:this={editor}
      value={DEMO}
      {variables}
      placeholder="Начните печатать или нажмите «/»"
      onChange={() => toolbar?.refresh()}
      data-testid="editor-demo"
    />
    <EditorToolbar bind:this={toolbar} view={editor?.getView() ?? null} position="bottom" />
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="bg-primary text-on-primary rounded-lg px-3 py-2 text-sm"
      onclick={() => (output = editor?.getMarkdown() ?? '')}
    >
      getMarkdown()
    </button>
    <button
      type="button"
      class="bg-secondary-container text-on-secondary-container rounded-lg px-3 py-2 text-sm"
      onclick={() => editor?.insertVariable('appName')}
    >
      insertVariable('appName')
    </button>
  </div>

  {#if output}
    <pre
      class="bg-surface-container max-h-96 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap"
      data-testid="editor-demo-output">{output}</pre>
  {/if}
</div>
