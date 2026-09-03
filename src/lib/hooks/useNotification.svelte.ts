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
export type NotificationVariant = 'default' | 'error' | 'success' | 'warning' | 'info';

/** Meteor.Error как есть — хук сам достаёт из него reason, код и details. */
export type NotificationError = {
  error?: unknown;
  reason?: string;
  details?: unknown;
};

export type NotificationOptions = {
  variant?: NotificationVariant;
  error?: NotificationError | null;
};

export function useNotification() {
  return {
    showNotification(text: string, options: NotificationOptions = {}) {
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
        // Объект ошибки уезжает как есть: разбор (reason → ключ, числовой error → HTTP-код,
        // message, details) живёт в errorHelpProps — один на тост и на <InlineError>.
        ...(withActions ? { description: ErrorToastActions, componentProps: { error } } : {}),
      };
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
