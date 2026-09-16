// QR-сканер камеры. Отдельный сабпуть (`apartx-ui/scanner`), как carousel: консьюмеры без
// сканера не тянут jsqr (optional peer).
export { default as QrScanner } from './QrScanner.svelte';
export type { QrScannerError } from './types';
