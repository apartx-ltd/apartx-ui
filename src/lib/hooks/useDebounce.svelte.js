/**
 * Debounce a reactive value.
 * @param {() => T} getter - Reactive getter function
 * @param {number} delay - Debounce delay in ms
 * @returns {{ current: T }}
 */
export function useDebounce(getter, delay = 300) {
  let result = $state({ current: getter() });

  $effect(() => {
    const value = getter();
    const timer = setTimeout(() => {
      result.current = value;
    }, delay);
    return () => clearTimeout(timer);
  });

  return result;
}
