interface ConfirmOptions {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  submitting: boolean;
}

let state = $state<ConfirmState>({
  open: false,
  submitting: false,
  title: 'Confirm',
  text: '',
  confirmText: 'Yes',
  cancelText: 'No',
});

let resolver: ((value: boolean) => void) | null = null;

export const ConfirmDialog = {
  get state() {
    return state;
  },

  open(options: ConfirmOptions = {}): Promise<boolean> {
    state = {
      ...state,
      title: options.title ?? 'Confirm',
      text: options.text ?? '',
      confirmText: options.confirmText ?? 'Yes',
      cancelText: options.cancelText ?? 'No',
      submitting: false,
      open: true,
    };
    return new Promise((resolve) => {
      resolver = resolve;
    });
  },

  close(result: boolean = false) {
    state = { ...state, open: false, submitting: false };
    resolver?.(result);
    resolver = null;
  },

  submitting(value: boolean) {
    state = { ...state, submitting: value };
  },
};
