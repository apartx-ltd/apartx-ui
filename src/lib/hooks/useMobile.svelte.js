/**
 * Reactive mobile detection.
 * @param {number} breakpoint - Max width for mobile (default 600 = MUI 'sm')
 * @returns {{ current: boolean }}
 */
export function useMobile(breakpoint = 600) {
  let result = $state({ current: false });

  $effect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    result.current = mq.matches;
    const handler = (e) => { result.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  return result;
}

/**
 * Reactive breakpoint detection.
 * @returns {{ current: 'xs'|'sm'|'md'|'lg'|'xl' }}
 */
export function useWidth() {
  let result = $state({ current: 'md' });

  $effect(() => {
    const breakpoints = [
      { name: 'xl', query: '(min-width: 1536px)' },
      { name: 'lg', query: '(min-width: 1200px)' },
      { name: 'md', query: '(min-width: 900px)' },
      { name: 'sm', query: '(min-width: 600px)' },
    ];

    function update() {
      for (const bp of breakpoints) {
        if (window.matchMedia(bp.query).matches) {
          result.current = bp.name;
          return;
        }
      }
      result.current = 'xs';
    }

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  return result;
}
