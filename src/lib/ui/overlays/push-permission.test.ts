// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Сам sonner здесь не нужен — проверяем, что и когда контроллер ему отдаёт.
vi.mock('svelte-sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));

import { toast } from 'svelte-sonner';
import {
  PUSH_PROMPT_SNOOZE_MS,
  createPushPermissionPrompt,
  decidePushPrompt,
  isPushPromptSnoozed,
  pushGuide,
} from './push-permission';

const toastMock = toast as unknown as ReturnType<typeof vi.fn> & { dismiss: ReturnType<typeof vi.fn> };
const KEY = 'test.pushPrompt.snoozedAt';

describe('decidePushPrompt', () => {
  const base = { supported: true, permission: 'default' as NotificationPermission, snoozedAt: null, now: 1_000_000_000 };

  it('default → просим, denied → объясняем', () => {
    expect(decidePushPrompt(base)).toEqual({ show: true, state: 'ask' });
    expect(decidePushPrompt({ ...base, permission: 'denied' })).toEqual({ show: true, state: 'denied' });
  });

  it('granted, неизвестно, нет поддержки — молчим', () => {
    expect(decidePushPrompt({ ...base, permission: 'granted' })).toEqual({ show: false });
    expect(decidePushPrompt({ ...base, permission: undefined })).toEqual({ show: false });
    expect(decidePushPrompt({ ...base, supported: false })).toEqual({ show: false });
  });

  it('снуз гасит оба состояния на неделю', () => {
    const snoozedAt = base.now - PUSH_PROMPT_SNOOZE_MS + 1;
    expect(decidePushPrompt({ ...base, snoozedAt })).toEqual({ show: false });
    expect(decidePushPrompt({ ...base, permission: 'denied', snoozedAt })).toEqual({ show: false });
    expect(decidePushPrompt({ ...base, snoozedAt: base.now - PUSH_PROMPT_SNOOZE_MS })).toEqual({ show: true, state: 'ask' });
    expect(isPushPromptSnoozed(null, base.now)).toBe(false);
  });
});

describe('pushGuide', () => {
  it('гифка под платформу, для iOS — нет', () => {
    const src = (cordova: boolean, os: 'ios' | 'android' | 'other') => pushGuide({ cordova, os })?.src;
    expect(src(true, 'android')).toBe('/images/guides/android_enable_native_notifications.gif');
    expect(src(false, 'android')).toBe('/images/guides/android_enable_web_notifications.gif');
    expect(src(false, 'other')).toBe('/images/guides/desktop_enable_web_notifications.gif');
    expect(src(true, 'ios')).toBeUndefined();
    expect(src(false, 'ios')).toBeUndefined();
    expect(pushGuide({ os: 'other', baseUrl: '/g/' })?.src).toBe('/g/desktop_enable_web_notifications.gif');
  });
});

describe('createPushPermissionPrompt', () => {
  let permission: NotificationPermission;
  let subscribe: ReturnType<typeof vi.fn>;

  const make = (extra: Record<string, unknown> = {}) =>
    createPushPermissionPrompt({
      getPermission: () => permission,
      subscribe,
      isSupported: () => true,
      snoozeKey: KEY,
      ...extra,
    });
  const lastOptions = () => toastMock.mock.calls.at(-1)?.[1];
  const click = (action: any) => {
    const event = { preventDefault: vi.fn() };
    action.onClick(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    toastMock.mockClear();
    toastMock.dismiss.mockClear();
    localStorage.clear();
    permission = 'default';
    subscribe = vi.fn(async () => {});
  });
  afterEach(() => vi.useRealTimers());

  it('default: «Разрешить» подписывается и тост не закрывает', async () => {
    await make().evaluate();
    const options = lastOptions();
    expect(options.id).toBe('push-permission');
    const event = click(options.action);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('denied: инструкция в description, кнопка настроек — только если есть куда вести', async () => {
    permission = 'denied';
    const guide = { src: '/g.gif', ratio: 1 };
    await make({ guide }).evaluate();
    expect(lastOptions().componentProps.guide).toEqual(guide);
    expect(lastOptions().action).toBeUndefined();

    toastMock.mockClear();
    const onOpenSettings = vi.fn();
    await make({ onOpenSettings }).evaluate();
    const event = click(lastOptions().action);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('включили в настройках — подписка, тост уходит, снуза нет', async () => {
    permission = 'denied';
    await make().evaluate();
    permission = 'granted';
    await vi.advanceTimersByTimeAsync(1000);
    expect(toastMock.dismiss).toHaveBeenCalledWith('push-permission');
    expect(subscribe).toHaveBeenCalledTimes(1);
    lastOptions().onDismiss();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('отказ в окне браузера меняет тост на инструкцию', async () => {
    await make().evaluate();
    permission = 'denied';
    await vi.advanceTimersByTimeAsync(1000);
    expect(lastOptions().componentProps).toBeDefined();
  });

  it('крестик — снуз, следующий evaluate молчит', async () => {
    const prompt = make();
    await prompt.evaluate();
    lastOptions().onDismiss();
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(0);
    toastMock.mockClear();
    await make().evaluate();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('stop убирает тост без снуза и гасит опрос', async () => {
    const prompt = make();
    await prompt.evaluate();
    const { onDismiss } = lastOptions();
    prompt.stop();
    onDismiss();
    expect(toastMock.dismiss).toHaveBeenCalledWith('push-permission');
    expect(localStorage.getItem(KEY)).toBeNull();
    permission = 'granted';
    await vi.advanceTimersByTimeAsync(3000);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
