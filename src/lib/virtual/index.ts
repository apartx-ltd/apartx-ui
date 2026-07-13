// Virtualization (virtua). Heavy-ish dep kept behind its own subpath
// (`apartx-ui/virtual`) so consumers that don't virtualize don't pay for it.
export { default as VirtualList, clearVirtualScroll } from './VirtualList.svelte';
export {
  default as MessagesList,
  getSavedPosition,
  clearMessagesPosition,
  type SavedListPosition,
} from './MessagesList.svelte';
