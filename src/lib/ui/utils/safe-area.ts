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

/** Низ контейнера в потоке (Page): забирает унаследованный нижний инсет, детям отдаёт 0. */
export const safeBottomFlow =
  'pb-[var(--safe-area-inset-bottom,0px)] [&>*]:[--safe-area-inset-bottom:0px]';

/** Полоска под статус-баром цвета шапки: у Page фон background, а не surface. */
export const safeTopStrip =
  'bg-[image:linear-gradient(var(--color-surface),var(--color-surface))] bg-no-repeat bg-[length:100%_var(--safe-area-inset-top,0px)]';

/**
 * Полоска под Footer его же фоном. Контейнер отступил снизу и отдал футеру ноль, поэтому под
 * футером осталась бы полоса цвета контейнера; ::after докрашивает её (фон наследуется, так
 * что работает и с классом хоста). Высота — корневая копия инсета: на вебе 0, а всё, что
 * выходит за контейнер, срезает его overflow. `:has()` для «Page без Footer» не годится —
 * его нет в Chrome 80 (compat/check.js).
 */
export const safeBottomStrip =
  "relative after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[var(--safe-area-root-bottom,0px)] after:bg-inherit after:content-['']";

/*
 * Панели оверлеев (Dialog, Drawer, BottomSheet) привязаны к вьюпорту и берут корневые копии
 * инсетов (styles/tokens.css): Drawer не портируется в body и внутри Page унаследовал бы
 * обнулённую переменную, а BottomSheet объявляют и внутри Page.
 */
export const safeTopViewport =
  'pt-[var(--safe-area-root-top,0px)] [&>*]:[--safe-area-inset-top:0px]';

export const safeBottomViewport =
  'pb-[var(--safe-area-root-bottom,0px)] [&>*]:[--safe-area-inset-bottom:0px]';
