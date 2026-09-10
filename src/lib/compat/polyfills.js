// Порог — Chrome 80 (docs/plans/2026-09-10-legacy-webview-compat/design.md). Meteor тут не помощник:
// его «современный» порог около Chrome 49, то есть Chrome 80..98 получает немодифицированный
// modern-бандл, а legacy-арки для Cordova нет вовсе. Поэтому полифилы подключаем сами —
// точечно, только то, чего нет в Chrome 80.
//
// Из core-js, а не самописные: первая версия этого файла была самописной и расходилась со
// спецификацией — replaceAll игнорировал `$&` в строке замены, structuredClone молча клонировал
// функции (нативный бросает DataCloneError) и превращал Uint8Array в обычный объект. core-js
// ставит свою реализацию только там, где нативной нет или она неисправна.
//
// Модули `core-js/modules/*`, а не входы `core-js/actual/*`: вход тянет за собой всё, от чего
// фича зависит в самом старом движке, — `actual/promise/any` везёт весь Promise, `actual/
// structured-clone` — Map, Set и итераторы. В Chrome 80 это всё нативное, а бандл вырастал
// до 26 КБ gzip против 14 КБ у тех же модулей напрямую.
//
// Расширение `.js` явное: у core-js нет карты `exports`, и без него путь не резолвит голый
// Node ESM (бандлерам всё равно).
import 'core-js/modules/es.object.has-own.js'; // Chrome 93
import 'core-js/modules/es.string.replace-all.js'; // Chrome 85
import 'core-js/modules/es.string.at-alternative.js'; // Chrome 92
import 'core-js/modules/es.array.at.js'; // Chrome 92
import 'core-js/modules/es.array.find-last.js'; // Chrome 97
import 'core-js/modules/es.array.find-last-index.js'; // Chrome 97
import 'core-js/modules/es.aggregate-error.js'; // Chrome 85, нужен Promise.any
import 'core-js/modules/es.promise.any.js'; // Chrome 85
import 'core-js/modules/web.structured-clone.js'; // Chrome 98

// Маркер для compat:check — строковый литерал в рантайме, а не комментарий: продовая сборка
// минифицируется, и комментарии из бандла вырезаются. Заодно ручная проба на устройстве:
// window['apartx-compat-polyfills'] в DevTools.
globalThis['apartx-compat-polyfills'] = true;
