/**
 * Reactive URL search params.
 * @returns {{ current: URLSearchParams }}
 */
export function useSearchQuery() {
  let result = $state({ current: new URLSearchParams(window.location.search) });

  $effect(() => {
    const handler = () => {
      result.current = new URLSearchParams(window.location.search);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  });

  return result;
}
