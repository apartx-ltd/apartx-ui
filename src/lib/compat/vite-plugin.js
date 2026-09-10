import { compatCss } from './compat-css.js';

const isCss = (id) => /\.css(\?|$)/.test(id);

/**
 * Vite-адаптер для apartx-help: там Tailwind подключён через '@tailwindcss/vite', PostCSS в
 * цепочке нет вовсе.
 *
 * Работаем в двух хуках, и это не подстраховка, а разные стадии:
 *
 * - в сборке одного `transform` НЕ хватает. `@tailwindcss/vite` досыпает сгенерированные
 *   утилиты позже, на стадии сборки ассетов, и `enforce: 'post'` тут не спасает — он
 *   упорядочивает плагины внутри стадии, а не между стадиями. Проверено на реальной сборке
 *   help: с одним только `transform` в `app.css` оставалось `@layer properties{…}` и `oklch()`.
 *   Поэтому в сборке правим готовые css-ассеты в `generateBundle`.
 * - в dev финального бандла нет вовсе, css приезжает модулем — там работает `transform`.
 *
 * Стадии взаимоисключающие (`configResolved` запоминает, какая идёт), чтобы CSS не проходил
 * через преобразование дважды: фолбэки единиц дописываются безусловно, и второй проход
 * наплодил бы дубли объявлений.
 */
export function apartxCompat() {
  let isBuild = false;

  return {
    name: 'apartx-compat',
    enforce: 'post',

    configResolved(config) {
      isBuild = config.command === 'build';
    },

    transform(code, id) {
      if (isBuild || !isCss(id)) return null;
      return { code: compatCss(code, { from: id }), map: null };
    },

    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !isCss(fileName)) continue;
        asset.source = compatCss(asset.source.toString(), { from: fileName });
      }
    },
  };
}
