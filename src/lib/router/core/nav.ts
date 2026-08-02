import { getHistory } from '../history/registry';
import { overlayCount, dismissForNavigation } from '../overlay/overlay-stack';
import type { Action } from '../history/adapter';

/** Программная SPA-навигация. При открытых оверлеях (и без keepOverlays) закрывает их
 *  (флип open=false, без history.back) и заменяет верхнюю синтетическую overlay-запись
 *  назначением (вариант A): оверлей исчезает, одинарный back возвращает на исходный
 *  экран. keepOverlays=true — push ПОД оверлеем (restore-on-back, напр. шторка карты).
 *  `action` пробрасывается в history на путях БЕЗ открытых оверлеев (push/replace) —
 *  так router.push(url, {action}) сохраняет направление транзишена; вариант A всегда
 *  идёт как 'forward' (это и есть навигация вперёд поверх закрывающегося оверлея). */
export function navigate(
  to: string,
  opts?: { replace?: boolean; keepOverlays?: boolean; action?: Action },
): void {
  const h = getHistory();
  const hOpts = opts?.action ? { action: opts.action } : undefined;
  // replace-with-open-overlay не поддерживается: перезапишет синтетическую запись, но
  // оставит оверлей в стеке (следующий back закроет фантом). На практике replace зовут
  // без открытых оверлеев (data-replace ссылки на страницах) ЛИБО осознанно поверх
  // выживающего оверлея (spaces: открытие property из шторки карты replace'ит её
  // синтетическую запись, шторка остаётся в survival store) — поэтому replace НЕ
  // делает dismissForNavigation. Вариант A — ниже.
  if (opts?.replace) { h.replace(to, hOpts); return; }
  if (!opts?.keepOverlays && overlayCount() > 0) {
    const wait = dismissForNavigation();
    // Дать уходящей анимации оверлея проиграть перед сменой роута: синхронный replace
    // уносит хостовую страницу (и оверлей) на полукадре — оверлей просто мигает. Ждём одну
    // exit-длительность, затем replace (съедает верхнюю синтетическую запись). При
    // reduced-motion анимации уже 0ms → навигируем сразу, без искусственной задержки.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (wait > 0 && !reduce) {
      setTimeout(() => h.replace(to, { action: 'forward' }), wait);
    } else {
      h.replace(to, { action: 'forward' });
    }
    return;
  }
  h.push(to, hOpts);
}

function shouldHandle(e: MouseEvent, target: string | null): boolean {
  return (
    e.button === 0 &&
    !e.defaultPrevented &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    (!target || target === '_self')
  );
}

/** `use:link` — перехватывает клик по <a> и делает SPA-навигацию вместо перезагрузки. */
export function link(node: HTMLAnchorElement) {
  const onClick = (e: MouseEvent) => {
    if (!shouldHandle(e, node.target)) return;
    const href = node.getAttribute('href');
    if (!href || /^[a-z]+:\/\//i.test(href)) return; // внешний/абсолютный → дефолт
    e.preventDefault();
    navigate(href, { replace: node.hasAttribute('data-replace') });
  };
  node.addEventListener('click', onClick);
  return { destroy: () => node.removeEventListener('click', onClick) };
}
