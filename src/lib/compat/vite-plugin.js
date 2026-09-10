import { compatCss } from './compat-css.js';

const isCss = (id) => /\.css(\?|$)/.test(id);

// Те же исключения, что у самого `vite:css`: под этими query в модуле не CSS, а JS
// (`export default "…"` от `?raw`/`?url`, обёртка воркера, commonjs-прокси).
const notCssModule = (id) => /[?&](?:worker|sharedworker|raw|url)\b|\?commonjs-proxy/.test(id);

/**
 * Vite-адаптер для apartx-help: там Tailwind подключён через '@tailwindcss/vite', PostCSS в
 * цепочке нет вовсе.
 *
 * Возвращает два плагина, и это не подстраховка, а разные стадии:
 *
 * - в сборке одного `transform` НЕ хватает. `@tailwindcss/vite` досыпает сгенерированные
 *   утилиты позже, на стадии сборки ассетов, и `enforce: 'post'` тут не спасает — он
 *   упорядочивает плагины внутри стадии, а не между стадиями. Проверено на реальной сборке
 *   help: с одним только `transform` в `app.css` оставалось `@layer properties{…}` и `oklch()`.
 *   Поэтому в сборке правим готовые css-ассеты в `generateBundle`.
 * - в dev финального бандла нет вовсе, css приезжает модулем — там работает `transform`, и
 *   как раз БЕЗ `enforce: 'post'`. Post-плагины Vite ставит после `vite:css-post`, а тот уже
 *   завернул CSS в JS (`__vite__updateStyle(…)`, `export default "…"` для `?inline`) — postcss
 *   падал на нём с `Unknown word`, и help в dev оставался без стилей. Обычный плагин стоит
 *   ровно между `vite:css` и `vite:css-post`: Tailwind (`generate:serve` — `enforce: 'pre'`)
 *   уже отработал, а обёртки ещё нет.
 *
 * Стадии взаимоисключающие (`apply`), чтобы CSS не проходил через преобразование дважды:
 * фолбэки единиц дописываются безусловно, и второй проход наплодил бы дубли объявлений.
 */
export function apartxCompat() {
  return [
    {
      name: 'apartx-compat:serve',
      apply: 'serve',

      transform(code, id) {
        if (!isCss(id) || notCssModule(id)) return null;
        return { code: compatCss(code, { from: id }), map: null };
      },
    },
    {
      name: 'apartx-compat:build',
      apply: 'build',
      enforce: 'post',

      generateBundle(_options, bundle) {
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (asset.type !== 'asset' || !isCss(fileName)) continue;
          asset.source = compatCss(asset.source.toString(), { from: fileName });
        }
      },
    },
  ];
}
