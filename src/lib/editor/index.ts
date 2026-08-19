export { default as Editor } from './Editor.svelte';
export { default as EditorToolbar } from './EditorToolbar.svelte';

export { editorSchema, VARIABLE_CLASS, VARIABLE_NAME } from './schema';
export { parseMarkdown, serializeMarkdown, markdownParser, markdownSerializer } from './markdown';
export { buildEditorPlugins } from './setup';
export * from './commands';

export { markdownPastePlugin, shouldParseAsMarkdown } from './plugins/paste';
export { openInsertMenu, insertMenuKey } from './plugins/insert-menu';
export { openLinkEditor, linkEditorKey } from './plugins/link-editor';
