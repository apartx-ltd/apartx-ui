import { getContext, setContext } from 'svelte';
import type { ErrorHelpArticle, ErrorHelpResolver } from './error-toast';

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
  labels?: { why?: string; copy?: string; copied?: string; support?: string };
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
