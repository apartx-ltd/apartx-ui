/*
 * Safe-area: инсет забирает контейнер, который касается края экрана, и отдаёт детям ноль
 * (AGENTS.md → «Safe-area»). Кордова-хост кладёт высоту статус-бара и home indicator в
 * --safe-area-inset-top/bottom на <html>; на вебе переменные не заданы и всё схлопывается в 0.
 *
 * В cn эти константы идут ПОСЛЕДНИМИ, после класса хоста: tailwind-merge снимает pt/pb,
 * если p-0 хоста приходит позже них, а в обратном порядке оба класса сосуществуют.
 */

/** Контейнер в потоке (Page): забирает унаследованный верхний инсет, детям отдаёт 0. */
export const safeTopFlow =
  'pt-[var(--safe-area-inset-top,0px)] [&>*]:[--safe-area-inset-top:0px]';

/** Полоска под статус-баром цвета шапки: у Page фон background, а не surface. */
export const safeTopStrip =
  'bg-[image:linear-gradient(var(--color-surface),var(--color-surface))] bg-no-repeat bg-[length:100%_var(--safe-area-inset-top,0px)]';

/*
 * Панели оверлеев привязаны к вьюпорту и берут корневые копии инсетов (styles/tokens.css):
 * Drawer не портируется в body и внутри Page унаследовал бы обнулённую переменную.
 */
export const safeTopViewport =
  'pt-[var(--safe-area-root-top,0px)] [&>*]:[--safe-area-inset-top:0px]';

export const safeBottomViewport =
  'pb-[var(--safe-area-root-bottom,0px)] [&>*]:[--safe-area-inset-bottom:0px]';
