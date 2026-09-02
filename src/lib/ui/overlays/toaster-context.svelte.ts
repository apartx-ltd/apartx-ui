import { getContext, setContext } from 'svelte';
import type { ErrorHelpArticle, ErrorHelpResolver } from './error-toast';

/**
 * z-index хоста тостов: `null` — дефолт sonner (`z-index: 999999999` на
 * `[data-sonner-toaster]`, то есть поверх всего), число — инлайновый стиль из
 * <ToasterMount>, который этот дефолт перебивает.
 *
 * По умолчанию тост НАД всем — так и надо: ошибка чаще всего прилетает из открытой
 * модалки, и там её нужно видеть и нажимать. Единственное исключение — статья, открытая
 * кнопкой «Почему?» самого тоста: её надо читать, а не разглядывать из-под тоста.
 * Поэтому на время этой статьи хост «ныряет» под слой модалок и возвращается, когда её
 * закрыли. Пробовать вычислить z по стеку модалок в момент показа тоста не годится:
 * оверлеи кита бывают и вне реестра (обычный `Dialog` с полосой z-60/61), и тост тогда
 * оказывается под тем, ради чего он и появился.
 *
 * 55 — выше контента `Dialog` по умолчанию (`z-50`), но ниже базы реестра модалок (60).
 */
const DUCKED_Z = 55;

export const toastLayer = $state<{ z: number | null }>({ z: null });

/** Увести хост тостов под слой модалок (на время статьи из «Почему?»). */
export function duckToasterUnderModals(): void {
  toastLayer.z = DUCKED_Z;
}

/** Вернуть хост тостов наверх. */
export function restoreToaster(): void {
  toastLayer.z = null;
}

/**
 * Хендлеры действий тоста ошибки. Кит не знает ни транспорта, ни навигации консьюмера —
 * всё инжектируется пропами <ToasterMount> и доезжает до <ErrorToastActions> контекстом
 * (компонент действий рендерится внутри дерева Toaster). Любой хендлер опционален:
 * без resolveErrorHelp кнопки «Почему?» нет, без onContactSupport — кнопки саппорта.
 * Подписи кнопок — тоже снаружи (кит не владеет i18n), с английскими дефолтами.
 */
export type ToasterHandlers = {
  resolveErrorHelp?: ErrorHelpResolver;
  onOpenArticle?: (article: ErrorHelpArticle) => void;
  onContactSupport?: (detailsText: string) => void;
  /** Дополнительные строки блока деталей (user, build, …) — снимаются в момент тоста. */
  detailsContext?: () => Record<string, string | undefined>;
  labels?: { why?: string; copy?: string; copied?: string; copyFailed?: string; support?: string };
};

/**
 * Геттер, а не значение — по той же причине, что и `setLocale` в i18n/context: подписи
 * кнопок консьюмер отдаёт из своего `t()`, и при смене языка на лету они должны
 * переехать. Захваченный объект остался бы на языке, который был при монтировании
 * <ToasterMount> (то есть навсегда, он живёт в корне приложения).
 */
export type ToasterHandlersGetter = () => ToasterHandlers;

const KEY = Symbol('apartx-ui:toaster-handlers');

export function setToasterHandlers(get: ToasterHandlersGetter): void {
  setContext(KEY, get);
}

export function getToasterHandlers(): ToasterHandlersGetter | undefined {
  return getContext<ToasterHandlersGetter | undefined>(KEY);
}
