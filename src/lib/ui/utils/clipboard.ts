/**
 * Копирование в буфер обмена с фолбэком на `document.execCommand('copy')`.
 *
 * `navigator.clipboard` существует ТОЛЬКО в secure context (https или localhost).
 * Дев-инстансы `wt` отдаются по `http://<host>:<port>`, Cordova-вебвью и старые
 * браузеры — тоже мимо; там `navigator.clipboard` просто `undefined`, и вызов
 * `writeText` падает. Прямой вызов без фолбэка выглядит как «кнопка не работает»
 * (именно так и сломалась «Скопировать» в тосте ошибки).
 *
 * Возвращает `true`, только если копирование действительно случилось — вызывающий
 * код обязан сообщать об отказе, а не рисовать «Скопировано» вслепую.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Разрешение не выдано или контекст не secure — пробуем легаси-путь ниже.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  // execCommand копирует ВЫДЕЛЕНИЕ, поэтому нужен реальный узел в DOM: скрытый
  // (`display:none`, `hidden`) не выделяется. Отсюда прозрачный 1×1 в углу.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}
