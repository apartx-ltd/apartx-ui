import { toast } from 'svelte-sonner';
import ErrorToastActions from '../ui/overlays/ErrorToastActions.svelte';
import { raiseToastLayer } from '../ui/overlays/toaster-context.svelte';

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
      // Тост висит, пока его не закроют (крестиком или свайпом). Дефолтные 4с sonner
      // рассчитаны на «прочитать и забыть»: сообщение об ошибке — часто единственный
      // след случившегося, а по строке действий («Почему?»/«В саппорт») ещё надо успеть
      // кликнуть. Success/info/default гаснут сами, как и раньше.
      const persistent = variant === 'error' || withActions;
      const data = {
        ...(persistent ? { duration: Number.POSITIVE_INFINITY } : {}),
        ...(withActions
          ? {
              description: ErrorToastActions,
              componentProps: {
                errorKey: error.reason,
                httpCode: typeof error.error === 'number' ? error.error : null,
                message,
                details: error.details,
              },
            }
          : {}),
      };
      // Тост встаёт над текущим стеком модалок, но под теми, что откроют после него
      // (в т.ч. над статьёй из его же кнопки «Почему?») — см. raiseToastLayer.
      raiseToastLayer();
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
