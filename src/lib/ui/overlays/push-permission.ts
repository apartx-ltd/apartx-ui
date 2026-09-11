import { toast } from 'svelte-sonner';
import { detectMobileOS, type MobileOS } from '../utils/os';
import PushPermissionDescription from './PushPermissionDescription.svelte';

/**
 * Тост «Разрешите уведомления» — общий для кабинета и spaces (преемник React-снэкбара
 * EnablePushSnack из кабинета).
 *
 * `default` → «Разрешить»: окно разрешения браузера открывается только из клика — Safari и
 * Firefox без жеста его не покажут, Chrome свернёт в значок. `denied` (и выключенные
 * уведомления в Cordova) → текст, гифка-инструкция под платформу и, если консьюмеру есть куда
 * вести, кнопка его страницы настроек: из JS блокировку уже не снять. Пока тост на экране,
 * разрешение опрашивается: включили в настройках — подписываемся и убираем тост. Закрытие
 * крестиком/свайпом — снуз на неделю.
 *
 * Кит не знает про Meteor и Push: разрешение, подписку и поддержку консьюмер передаёт
 * функциями, тексты — `labels` (английские дефолты, переводит call site).
 */

export type PushPromptState = 'ask' | 'denied';

export const PUSH_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PushPromptInput {
  // Веб: браузер умеет push и messaging поднялся. Cordova: всегда true.
  supported: boolean;
  // Веб — Notification.permission. Cordova — hasPermission(), приведённый к тем же строкам.
  permission: NotificationPermission | undefined;
  snoozedAt: number | null | undefined;
  now: number;
}

export type PushPromptDecision = { show: false } | { show: true; state: PushPromptState };

export function isPushPromptSnoozed(snoozedAt: number | null | undefined, now: number): boolean {
  return typeof snoozedAt === 'number' && now - snoozedAt < PUSH_PROMPT_SNOOZE_MS;
}

/**
 * Где push не поддерживается (iOS Safari вне PWA, встроенные WebView), просить бессмысленно.
 * `granted` — просить нечего; неизвестное разрешение — молчим.
 */
export function decidePushPrompt(i: PushPromptInput): PushPromptDecision {
  if (!i.supported) return { show: false };
  if (i.permission !== 'default' && i.permission !== 'denied') return { show: false };
  if (isPushPromptSnoozed(i.snoozedAt, i.now)) return { show: false };
  return { show: true, state: i.permission === 'default' ? 'ask' : 'denied' };
}

export interface PushGuide {
  src: string;
  // Ширина / высота гифки — Image резервирует место под неё до загрузки.
  ratio: number;
}

const GUIDES = {
  androidNative: { file: 'android_enable_native_notifications.gif', ratio: 320 / 361 },
  androidWeb: { file: 'android_enable_web_notifications.gif', ratio: 315 / 320 },
  desktopWeb: { file: 'desktop_enable_web_notifications.gif', ratio: 320 / 271 },
};

/**
 * Гифка «как включить уведомления» под платформу. Сами гифки консьюмер кладёт у себя в
 * `public` под `baseUrl`. Для iOS гифки нет ни в приложении, ни в Safari — там `null`.
 */
export function pushGuide({
  cordova = false,
  os = detectMobileOS(),
  baseUrl = '/images/guides/',
}: { cordova?: boolean; os?: MobileOS; baseUrl?: string } = {}): PushGuide | null {
  const pick = (g: { file: string; ratio: number }) => ({ src: baseUrl + g.file, ratio: g.ratio });
  if (os === 'android') return pick(cordova ? GUIDES.androidNative : GUIDES.androidWeb);
  if (cordova || os === 'ios') return null;
  return pick(GUIDES.desktopWeb);
}

export interface PushPromptLabels {
  title: string;
  text: string;
  allow: string;
  deniedText: string;
  instructions: string;
  settings: string;
}

const DEFAULT_LABELS: PushPromptLabels = {
  title: 'Push Notifications',
  text: 'To receive notifications of new messages, you need to enable push notifications.',
  allow: 'Allow',
  deniedText:
    'You have blocked push notifications. To receive instant notifications of new messages, you need to allow notifications.',
  instructions: 'Instructions',
  settings: 'Notifications Settings',
};

export interface PushPermissionPromptOptions {
  /** Текущее разрешение: веб — `Notification.permission`, Cordova — hasPermission() в строках. */
  getPermission: () => Promise<NotificationPermission | undefined> | NotificationPermission | undefined;
  /** Подписка на пуши (`Push.subscribe`) — на вебе сама открывает окно разрешения. */
  subscribe: () => unknown;
  /** Умеет ли устройство push. */
  isSupported: () => Promise<boolean> | boolean;
  /** Ключ localStorage для снуза. */
  snoozeKey: string;
  /** Тексты — функцией, чтобы брались на языке момента показа. */
  labels?: () => Partial<PushPromptLabels>;
  /** Инструкция для заблокированных уведомлений (см. pushGuide); null — без неё. */
  guide?: PushGuide | null;
  /** Кнопка «Настройки уведомлений» в `denied`; без неё тост без действия. */
  onOpenSettings?: () => void;
  id?: string;
  pollMs?: number;
}

export interface PushPermissionPrompt {
  /** Решить и показать тост. Повторный вызов с тем же состоянием ничего не делает. */
  evaluate(): Promise<void>;
  /** Убрать тост и остановить опрос — без снуза (это не отказ пользователя). */
  stop(): void;
}

export function createPushPermissionPrompt(o: PushPermissionPromptOptions): PushPermissionPrompt {
  const id = o.id ?? 'push-permission';
  const pollMs = o.pollMs ?? 1000;
  let active = true;
  // Какое состояние сейчас на экране; null — тоста нет.
  let shown: PushPromptState | null = null;
  // Клик «Разрешить» подписывается сам — опрос в это время второй подписки не делает.
  let subscribing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function readSnooze(): number | null {
    try {
      const v = Number(localStorage.getItem(o.snoozeKey));
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  function snooze() {
    try {
      localStorage.setItem(o.snoozeKey, String(Date.now()));
    } catch {
      // Хранилище недоступно (приватный режим) — тост просто вернётся при следующем заходе.
    }
  }

  // Убираем тост сами (разрешение выдано, stop) — это не отказ, снуза нет.
  function close() {
    shown = null;
    clearTimeout(timer);
    toast.dismiss(id);
  }

  // sonner зовёт onDismiss и на программный toast.dismiss — снуз, только если тост закрыл
  // пользователь: close() к этому моменту уже обнулил `shown`.
  function dismissedByUser() {
    clearTimeout(timer);
    if (active && shown) snooze();
    shown = null;
  }

  // Разрешение меняют вне приложения (настройки браузера или системы), а событие об этом есть
  // не везде — пока тост на экране, опрашиваем.
  function schedulePoll() {
    clearTimeout(timer);
    timer = setTimeout(poll, pollMs);
  }

  async function subscribe() {
    try {
      await o.subscribe();
    } catch (e) {
      console.error('[push-permission] subscribe failed', e);
    }
  }

  async function poll() {
    if (!shown) return;
    const permission = await o.getPermission();
    if (!shown) return;
    if (permission === 'granted') {
      close();
      // Включили в настройках — токена ещё нет, подписываемся сами.
      if (!subscribing) await subscribe();
      return;
    }
    // Отказ в окне браузера — сразу объясняем, где это вернуть.
    if (permission === 'denied' && shown === 'ask') show('denied');
    schedulePoll();
  }

  async function allow() {
    subscribing = true;
    await subscribe();
    subscribing = false;
  }

  function show(state: PushPromptState) {
    shown = state;
    const l = { ...DEFAULT_LABELS, ...o.labels?.() };
    if (state === 'ask') {
      toast(l.title, {
        id,
        duration: Number.POSITIVE_INFINITY,
        description: l.text,
        action: {
          label: l.allow,
          onClick: (event: MouseEvent) => {
            // Тост остаётся до ответа в окне браузера — его уберёт или сменит опрос.
            event.preventDefault();
            allow();
          },
        },
        onDismiss: dismissedByUser,
      });
      schedulePoll();
      return;
    }
    const onOpenSettings = o.onOpenSettings;
    toast(l.title, {
      id,
      duration: Number.POSITIVE_INFINITY,
      description: PushPermissionDescription,
      componentProps: { text: l.deniedText, instructionsLabel: l.instructions, guide: o.guide ?? null },
      ...(onOpenSettings
        ? {
            action: {
              label: l.settings,
              onClick: (event: MouseEvent) => {
                // Инструкция нужна и на странице настроек — тост не закрываем.
                event.preventDefault();
                onOpenSettings();
              },
            },
          }
        : {}),
      onDismiss: dismissedByUser,
    } as any);
    schedulePoll();
  }

  return {
    async evaluate() {
      const [supported, permission] = await Promise.all([o.isSupported(), o.getPermission()]);
      if (!active) return;
      const decision = decidePushPrompt({ supported, permission, snoozedAt: readSnooze(), now: Date.now() });
      if (!decision.show || shown === decision.state) return;
      show(decision.state);
    },
    stop() {
      active = false;
      close();
    },
  };
}
