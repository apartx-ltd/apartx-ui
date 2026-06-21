import { getHistory } from '../history/registry';

/** Программная SPA-навигация (по умолчанию push; replace по опции). */
export function navigate(to: string, opts?: { replace?: boolean }): void {
  if (opts?.replace) getHistory().replace(to);
  else getHistory().push(to);
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
