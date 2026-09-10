import { compatCss } from './compat-css.js';

/**
 * Vite-адаптер для apartx-help: там Tailwind подключён через '@tailwindcss/vite', PostCSS в
 * цепочке нет вовсе. `enforce: 'post'` ставит нас после плагина Tailwind — это проверяется
 * на реальной сборке, полагаться на порядок вслепую нельзя.
 */
export function apartxCompat() {
  return {
    name: 'apartx-compat',
    enforce: 'post',
    transform(code, id) {
      if (!/\.css(\?|$)/.test(id)) return null;
      return { code: compatCss(code, { from: id }), map: null };
    },
  };
}
