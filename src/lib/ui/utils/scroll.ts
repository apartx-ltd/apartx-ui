/**
 * Svelte action: reveal a scrollable element's scrollbar only while it is being
 * scrolled, then hide it after an idle delay. Pair with the `scrollbar-autohide`
 * utility (from `apartx-ui/styles/tokens.css`), which keeps the track width
 * constant so toggling causes no layout shift.
 *
 * @example
 *   <div class="overflow-y-auto scrollbar-autohide" use:autohideScroll>…</div>
 */
export function autohideScroll(node: HTMLElement, params?: { delay?: number }) {
  let delay = params?.delay ?? 900;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onScroll = () => {
    node.classList.add('is-scrolling');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove('is-scrolling'), delay);
  };

  node.addEventListener('scroll', onScroll, { passive: true });

  return {
    update(next?: { delay?: number }) {
      delay = next?.delay ?? 900;
    },
    destroy() {
      if (timer) clearTimeout(timer);
      node.removeEventListener('scroll', onScroll);
    },
  };
}
