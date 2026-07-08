// Cross-platform long-press detector for list items, as a Svelte action.
// Android Chrome fires `contextmenu` on long-press; iOS WebKit does NOT for
// non-link/non-image elements, so we detect long-press via touch events while
// preserving `contextmenu` for desktop right-click. Suppresses the click that
// follows a touch long-press; cancels on move beyond tolerance. Use as
// `use:longpress={{ onClick, onTrigger }}`.
export interface LongPressOpts {
  onTrigger?: (e: { clientX: number; clientY: number; type: string }) => void;
  onClick?: (e?: Event) => void;
  threshold?: number;
  moveTolerance?: number;
}

const DEFAULT_THRESHOLD = 500;
const DEFAULT_MOVE_TOLERANCE = 10;

export function longpress(node: HTMLElement, opts: LongPressOpts = {}) {
  let o = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let suppressClick = false;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const fire = (clientX: number, clientY: number, type: string) => {
    if (type === 'touch') suppressClick = true;
    o.onTrigger?.({ clientX, clientY, type });
  };

  const onClick = (e: Event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    o.onClick?.(e);
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    cancel();
    fire(e.clientX, e.clientY, 'contextmenu');
  };
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches?.length !== 1) return;
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (start) fire(start.x, start.y, 'touch');
    }, o.threshold ?? DEFAULT_THRESHOLD);
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!(timer && start && e.touches?.length === 1)) return;
    const t = e.touches[0];
    const tol = o.moveTolerance ?? DEFAULT_MOVE_TOLERANCE;
    if (Math.abs(t.clientX - start.x) > tol || Math.abs(t.clientY - start.y) > tol) cancel();
  };
  const onTouchEnd = () => cancel();

  node.style.webkitTouchCallout = 'none';
  (node.style as any).webkitUserSelect = 'none';
  node.style.userSelect = 'none';

  node.addEventListener('click', onClick);
  node.addEventListener('contextmenu', onContextMenu);
  node.addEventListener('touchstart', onTouchStart, { passive: true });
  node.addEventListener('touchmove', onTouchMove, { passive: true });
  node.addEventListener('touchend', onTouchEnd);
  node.addEventListener('touchcancel', onTouchEnd);

  return {
    update(next: LongPressOpts) {
      o = next ?? {};
    },
    destroy() {
      cancel();
      node.removeEventListener('click', onClick);
      node.removeEventListener('contextmenu', onContextMenu);
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    },
  };
}
