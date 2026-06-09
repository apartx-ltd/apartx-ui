export { default as Dialog } from './Dialog.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as AlertDialog } from './AlertDialog.svelte';
export { default as Drawer } from './Drawer.svelte';
// Bottom-sheet (iOS-style draggable pane). Requires the optional `cupertino-pane`
// peer dep — only consumers that import this component need it installed.
export { default as CupertinoPane } from './CupertinoPane.svelte';
export { default as BottomSheet } from './BottomSheet.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as DropdownMenu } from './DropdownMenu.svelte';
export { default as ToasterMount } from './ToasterMount.svelte';

// Global confirm service (mount <ConfirmDialog/> once at app root, then call confirm.open()).
export { ConfirmDialog as confirm } from './confirm.svelte';
