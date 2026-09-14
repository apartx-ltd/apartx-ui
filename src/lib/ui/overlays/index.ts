export { default as Dialog } from './Dialog.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as AlertDialog } from './AlertDialog.svelte';
export { default as Drawer } from './Drawer.svelte';
// Bottom-sheet (iOS-style draggable pane with snap points), built on bits-ui Dialog +
// a custom gesture layer. Superseded the old cupertino-pane based CupertinoPane.
export { default as BottomSheet } from './BottomSheet.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as DropdownMenu } from './DropdownMenu.svelte';
// Хост тостов (svelte-sonner) — только монтирование и z-полоса. Что рисуется внутри
// тоста (строка действий ошибки, подсказки), кит не знает: это слой хоста поверх кита.
export { default as ToasterMount } from './ToasterMount.svelte';
// Слой хоста тостов: единственный `$state` на приложение — слой поверх кита ныряет тостер
// под модалки на время окна, открытого из тоста, через эти же функции, а не через копию.
export { toastLayer, toasterZ, duckToasterUnderModals, restoreToaster } from './toaster-context.svelte';

// Global confirm service (mount <ConfirmDialog/> once at app root, then call confirm.open()).
export { ConfirmDialog as confirm } from './confirm.svelte';

// Overlay stacking-layer context — hosts that stack overlays inject a z-band; nav-aware
// components (portalled dropdowns living inside a Dialog) read it to sit above the dialog.
export { getOverlayLayer, setOverlayLayer, provideOverlayZ, type OverlayLayer } from './layer-context';
