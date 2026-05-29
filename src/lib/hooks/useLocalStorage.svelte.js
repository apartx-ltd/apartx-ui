/**
 * Reactive localStorage binding.
 * @param {string} key - localStorage key
 * @param {T} defaultValue - Default value
 * @returns {{ current: T }}
 */
export function useLocalStorage(key, defaultValue) {
  let stored;
  try {
    const raw = localStorage.getItem(key);
    stored = raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    stored = defaultValue;
  }

  let result = $state({ current: stored });

  $effect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(result.current));
    } catch {
      // quota exceeded or private browsing
    }
  });

  return result;
}
