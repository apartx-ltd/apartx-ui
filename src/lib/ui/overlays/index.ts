export { default as Dialog } from './Dialog.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as AlertDialog } from './AlertDialog.svelte';
export { default as Drawer } from './Drawer.svelte';
// Bottom-sheet (iOS-style draggable pane with snap points), built on bits-ui Dialog +
// a custom gesture layer. Superseded the old cupertino-pane based CupertinoPane.
export { default as BottomSheet } from './BottomSheet.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as DropdownMenu } from './DropdownMenu.svelte';
export { default as ToasterMount } from './ToasterMount.svelte';
// Строка действий тоста ошибки (Почему?/Скопировать/В саппорт) — консьюмер её сам не
// рендерит, её ставит useNotification в `description`; наружу торчат типы и кэш-хелперы.
export { default as ErrorToastActions } from './ErrorToastActions.svelte';
// Ошибка под формой с той же строкой действий, что у тоста; текст слотом, `error` — объект.
export { default as InlineError } from './InlineError.svelte';
export { setToasterHandlers, getToasterHandlers, type ToasterHandlers } from './toaster-context.svelte';
export {
  resolveErrorHelp, clearErrorHelpCache, buildErrorDetails, sanitizeDetails, errorHelpProps,
  type ErrorHelpArticle, type ErrorHelpResolver, type ErrorHelpProps,
} from './error-toast';

// Тост «Разрешите уведомления» (кабинет, spaces): политика показа, гифка-инструкция под
// платформу и контроллер с опросом разрешения. Push/Meteor консьюмер передаёт функциями.
export { default as PushPermissionDescription } from './PushPermissionDescription.svelte';
export {
  createPushPermissionPrompt, decidePushPrompt, isPushPromptSnoozed, pushGuide, PUSH_PROMPT_SNOOZE_MS,
  type PushPermissionPrompt, type PushPermissionPromptOptions, type PushPromptLabels,
  type PushPromptState, type PushPromptInput, type PushPromptDecision, type PushGuide,
} from './push-permission';

// Global confirm service (mount <ConfirmDialog/> once at app root, then call confirm.open()).
export { ConfirmDialog as confirm } from './confirm.svelte';

// Overlay stacking-layer context — hosts that stack overlays inject a z-band; nav-aware
// components (portalled dropdowns living inside a Dialog) read it to sit above the dialog.
export { getOverlayLayer, setOverlayLayer, type OverlayLayer } from './layer-context';
