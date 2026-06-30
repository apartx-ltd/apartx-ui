// === ApartX UI Kit — main barrel ===
// Components are also available via category subpaths:
//   apartx-ui/structure · apartx-ui/display · apartx-ui/data
//   apartx-ui/forms · apartx-ui/overlays · apartx-ui/hooks · apartx-ui/theme

// Structure
export * from './ui/structure';

// Display (incl. Link)
export * from './ui/display';

// Navigation (Navigator contract, setNavigator/getNavigator, PageTransition)
export * from './navigation';

// Data
export * from './ui/data';

// Forms (incl. createForm)
export * from './ui/forms';

// Overlays (incl. confirm service + ToasterMount)
export * from './ui/overlays';

// Modals (generic lazy registry: open/ModalOutlet/setModalRegistry)
export * from './modals';

// Hooks
export * from './hooks';

// Theme utilities
export * from './theme';

// NOTE: virtualization (`VirtualList`/`MessagesList`, virtua) is intentionally NOT
// re-exported here — import it from the `apartx-ui/virtual` subpath so the
// `virtua` dependency stays out of bundles that don't need it.

// Chat (message engine + components)
export * from './chat';

// Utils
export { cn } from './ui/utils/cn';
export * from './ui/utils/date';
export { overlayFade, dialogPop, sheet, type SheetSide } from './ui/utils/motion';
export { scrollRestore, clearScrollPosition } from './ui/utils/scroll-restore';
