// === ApartX UI Kit — utils barrel (`apartx-ui/utils`) ===
// Хелперы без DOM-компонентов, которые нужны хостам и пакетам поверх кита (apartx-shared)
// без корневого барреля: тот тянет за собой чат и его зависимости. `cn` дублируется и в
// корне — оставлен ради обратной совместимости консьюмеров.
export { cn } from './cn';
export { copyText } from './clipboard';
export { detectMobileOS, type MobileOS } from './os';
