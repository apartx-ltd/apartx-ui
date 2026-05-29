import { toast } from 'svelte-sonner';

/**
 * Notification helper using svelte-sonner.
 * Replaces notistack's useSnackbar.
 */
export function useNotification() {
  return {
    showNotification(text, options = {}) {
      const { variant = 'default' } = options;
      switch (variant) {
        case 'error':
          toast.error(text);
          break;
        case 'success':
          toast.success(text);
          break;
        case 'warning':
          toast.warning(text);
          break;
        case 'info':
          toast.info(text);
          break;
        default:
          toast(text);
      }
    },
  };
}
