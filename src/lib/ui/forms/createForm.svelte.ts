import { z, type ZodSchema } from 'zod';

/**
 * Lightweight form state helper with Zod validation.
 *
 * @example
 * const form = createForm({
 *   schema: z.object({ name: z.string().min(1), email: z.string().email() }),
 *   initial: { name: '', email: '' },
 *   onSubmit: async (data) => { await saveUser(data); }
 * });
 * // form.fields.name, form.errors.name, form.handleSubmit(), form.submitting
 */
export function createForm<T extends Record<string, any>>(options: {
  schema: ZodSchema<T>;
  initial: T;
  onSubmit: (data: T) => Promise<void> | void;
}) {
  let fields = $state({ ...options.initial });
  let errors = $state<Record<string, string>>({});
  let submitting = $state(false);

  function validate(): boolean {
    const result = options.schema.safeParse(fields);
    if (result.success) {
      errors = {};
      return true;
    }
    const newErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!newErrors[key]) {
        newErrors[key] = issue.message;
      }
    }
    errors = newErrors;
    return false;
  }

  async function handleSubmit() {
    if (!validate()) return;
    submitting = true;
    try {
      await options.onSubmit(fields as T);
    } finally {
      submitting = false;
    }
  }

  function reset() {
    Object.assign(fields, options.initial);
    errors = {};
  }

  return {
    get fields() { return fields; },
    get errors() { return errors; },
    get submitting() { return submitting; },
    handleSubmit,
    validate,
    reset,
  };
}
