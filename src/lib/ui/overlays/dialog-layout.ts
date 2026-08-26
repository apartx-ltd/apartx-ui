// Плотность модалки. `form` — тело с отступами (поля, текст); `list` — тело без боковых
// отступов, край держит Item (px-4), поэтому строки и разделители идут во всю ширину.
// Значения адаптивные: на узком экране 16px, с sm (640px) — прежние 24px.
export type DialogLayout = 'form' | 'list';

export function dialogBodyClass(layout: DialogLayout = 'form'): string {
  if (layout === 'list') return 'px-0 py-2';
  return 'px-4 py-3 sm:px-6 sm:py-4';
}
