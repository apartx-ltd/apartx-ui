import { getHistory } from '../history/registry';
import { overlayCount, dismissForNavigation } from '../overlay/overlay-stack';

/** Программная SPA-навигация. При открытых оверлеях (и без keepOverlays) закрывает их
 *  (флип open=false, без history.back) и заменяет верхнюю синтетическую overlay-запись
 *  назначением (вариант A): оверлей исчезает, одинарный back возвращает на исходный
 *  экран. keepOverlays=true — push ПОД оверлеем (restore-on-back, напр. шторка карты). */
export function navigate(
  to: string,
  opts?: { replace?: boolean; keepOverlays?: boolean },
): void {
  const h = getHistory();
  if (opts?.replace) { h.replace(to); return; }
  if (!opts?.keepOverlays && overlayCount() > 0) {
    dismissForNavigation();
    h.replace(to, { action: 'forward' });
    return;
  }
  h.push(to);
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
