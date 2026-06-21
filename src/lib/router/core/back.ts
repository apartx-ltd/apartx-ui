// Единый примитив «назад», которым пользуются и useRouter().back(), и глобальный
// superapp-back контроллер (plain-функция, без рун — контроллер не компонент).
//  • есть история внутри приложения → history.back() (вернёт страницу ИЛИ закроет
//    оверлей через popstate-делегацию);
//  • иначе cold deep-link → navigate(<Route back>, {replace}) в логич. родитель;
//  • иначе корень → no-op.
import { getHistory } from '../history/registry';
import { navigate } from './nav';
import { getRouteBack } from './active-route';

export function canGoBack(): boolean {
  return getHistory().canGoBack;
}

export function currentHasParent(): boolean {
  return getHistory().canGoBack || getRouteBack() != null;
}

export function goBack(): void {
  if (getHistory().canGoBack) {
    getHistory().goBack();
    return;
  }
  const parent = getRouteBack();
  if (parent) navigate(parent, { replace: true });
}
