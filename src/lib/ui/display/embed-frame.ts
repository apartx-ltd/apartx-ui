// Контракт EmbedFrame. Типы вынесены из компонента: Svelte не экспортирует типы из
// instance-скрипта, а потребителям (onStatusChange, bind:this) они нужны.
export type EmbedFrameStatus = 'loading' | 'ready' | 'timeout';
export type EmbedFramePost = (message: unknown) => void;

/** Origin документа кадра — из его же src. Пустая строка (нет src, относительный или битый
 *  URL) никого не пропускает через фильтр входящих сообщений.
 *
 *  Разбор БЕЗ базы — намеренно: с `window.location.href` относительный и вообще любой мусор
 *  («::nope») резолвился бы в origin хоста, то есть фильтр молча начинал бы доверять
 *  собственному origin вместо явного отказа. Встроенный документ у нас всегда по абсолютному
 *  URL (сервер даже отказывается хранить относительный iframeUrl как признак поломанной
 *  конфигурации), поэтому строгость ничего не стоит. */
export function originOf(src: string | null | undefined): string {
  if (!src) return '';
  try {
    return new URL(src).origin;
  } catch {
    return '';
  }
}
