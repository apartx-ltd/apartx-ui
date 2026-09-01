import { toast } from 'svelte-sonner';
import ErrorToastActions from '../ui/overlays/ErrorToastActions.svelte';

/**
 * Notification helper using svelte-sonner.
 * Replaces notistack's useSnackbar.
 *
 * `options.error` — Meteor.Error как есть: у error/warning-тостов включает строку
 * действий (Почему?/Скопировать/В саппорт — спека docs/plans/2026-09-01-error-toast-actions
 * в оркестраторе). Хук достаёт из объекта reason (ключ i18n), error (HTTP-код) и details сам,
 * поэтому на call site дописывается ровно одно поле.
 *
 * `text` у мигрированных вызовов остаётся: часть мест переводит не reason, а пишет свою
 * формулировку. Переводить reason сам хук не может — кит не владеет i18n (весь его текст
 * приходит пропами), так что пустой text при переданном error покажет сырой ключ.
 */
export function useNotification() {
  return {
    showNotification(text, options = {}) {
      const { variant = 'default', error } = options;
      const message = text || error?.reason || '';
      const withActions = (variant === 'error' || variant === 'warning') && error?.reason;
      const data = withActions
        ? {
            description: ErrorToastActions,
            componentProps: {
              errorKey: error.reason,
              httpCode: typeof error.error === 'number' ? error.error : null,
              message,
              details: error.details,
            },
          }
        : {};
      switch (variant) {
        case 'error':
          toast.error(message, data);
          break;
        case 'success':
          toast.success(message);
          break;
        case 'warning':
          toast.warning(message, data);
          break;
        case 'info':
          toast.info(message);
          break;
        default:
          toast(message);
      }
    },
  };
}
