/**
 * Boolean state with open/close helpers.
 * @param {boolean} initial
 * @returns {{ isOpen: boolean, open: () => void, close: () => void, toggle: () => void }}
 */
export function useDisclosure(initial = false) {
  let isOpen = $state(initial);

  return {
    get isOpen() { return isOpen; },
    set isOpen(v) { isOpen = v; },
    open() { isOpen = true; },
    close() { isOpen = false; },
    toggle() { isOpen = !isOpen; },
  };
}
