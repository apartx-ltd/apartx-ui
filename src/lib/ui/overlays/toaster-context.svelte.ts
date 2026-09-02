import { getContext, setContext } from 'svelte';
import { stack, zForDepth } from '../../modals/registry.svelte';
import type { ErrorHelpArticle, ErrorHelpResolver } from './error-toast';

/**
 * z-index хоста тостов.
 *
 * Правило: тост стоит чуть выше стека модалок, каким тот был В МОМЕНТ ПОКАЗА тоста, и
 * ниже всего, что открыли после. Отсюда обе нужные вещи разом:
 *  - ошибка, прилетевшая ИЗ открытой модалки, видна и кликабельна поверх неё (а ошибки
 *    чаще всего оттуда и прилетают);
 *  - статья, открытая по кнопке «Почему?» этого же тоста, ложится ПОВЕРХ него — модалка
 *    уходит на следующую ступень стека (zForDepth), и тост её не перекрывает.
 *
 * Дефолт sonner — `z-index: 999999999` на `[data-sonner-toaster]`, то есть поверх всего
 * и навсегда; перебивается инлайновым стилем из <ToasterMount>.
 *
 * Фолбэк 55 (стек пуст): выше дефолтного контента kit-овского `Dialog` (`z-50`), но ниже
 * базы реестра модалок (60), чтобы открытая следом модалка накрыла тост.
 */
const NO_MODAL_Z = 55;
const ABOVE_TOP_MODAL = 2; // scrim = z, контент = z+1, тост = z+2

export const toastLayer = $state({ z: NO_MODAL_Z });

/** Снять z под новый тост. Зовётся из useNotification ПЕРЕД `toast.*`. */
export function raiseToastLayer(): void {
  toastLayer.z = stack.length ? zForDepth(stack.length - 1) + ABOVE_TOP_MODAL : NO_MODAL_Z;
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
