// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import ToasterMount from '../ui/overlays/ToasterMount.svelte';
import { clearErrorHelpCache } from '../ui/overlays/error-toast';
import { useNotification } from './useNotification.svelte';

// Контракт call site: showNotification(text, {variant:'error', error}) — один
// дописанный ключ включает строку действий. Обратная совместимость обязательна:
// не-error вызовы про поле не знают и должны работать как раньше.

beforeAll(() => {
  if (!window.matchMedia) {
    (window as any).matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
  }
});

let mounted: any[] = [];

function mountToaster(props: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const handle = mount(ToasterMount as any, { target: el, props: props as any });
  mounted.push(handle);
  flushSync();
  return handle;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const toastText = () => document.body.textContent ?? '';

beforeEach(() => {
  clearErrorHelpCache();
  document.body.innerHTML = '';
  mounted = [];
});

afterEach(() => {
  for (const h of mounted) {
    try { unmount(h); } catch { /* уже размонтирован */ }
  }
  toast.dismiss();
  document.body.innerHTML = '';
});

describe('showNotification', () => {
  it('error + error-объект → строка действий и резолв по reason', async () => {
    const resolveErrorHelp = vi.fn().mockResolvedValue([{ slug: 'a', title: 't' }]);
    mountToaster({ resolveErrorHelp, onOpenArticle: vi.fn(), onContactSupport: vi.fn() });

    const { showNotification } = useNotification();
    showNotification('Замок не найден', {
      variant: 'error',
      error: { error: 404, reason: 'errors.lock_not_found' },
    });
    flushSync();
    await tick();
    flushSync();

    expect(resolveErrorHelp).toHaveBeenCalledWith('errors.lock_not_found', 'en');
    expect(byTestId('error-toast-why')).toBeTruthy();
    expect(toastText()).toContain('Замок не найден');
  });

  it('error без объекта — прежний тост без действий (обратная совместимость)', async () => {
    mountToaster({ resolveErrorHelp: vi.fn(), onContactSupport: vi.fn() });

    const { showNotification } = useNotification();
    showNotification('Просто ошибка', { variant: 'error' });
    flushSync();
    await tick();
    flushSync();

    expect(byTestId('error-toast-copy')).toBeNull();
    expect(toastText()).toContain('Просто ошибка');
  });

  it('success с error-объектом действий не получает', async () => {
    mountToaster({ resolveErrorHelp: vi.fn(), onContactSupport: vi.fn() });

    const { showNotification } = useNotification();
    showNotification('Сохранено', {
      variant: 'success',
      error: { error: 404, reason: 'errors.lock_not_found' },
    });
    flushSync();
    await tick();
    flushSync();

    expect(byTestId('error-toast-copy')).toBeNull();
  });

  it('warning с error-объектом действия получает', async () => {
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]), onContactSupport: vi.fn() });

    const { showNotification } = useNotification();
    showNotification('Внимание', {
      variant: 'warning',
      error: { error: 409, reason: 'errors.already_claimed' },
    });
    flushSync();
    await tick();
    flushSync();

    expect(byTestId('error-toast-copy')).toBeTruthy();
  });

  it('пустой text при наличии error показывает сырой ключ (кит не переводит)', async () => {
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]), onContactSupport: vi.fn() });

    const { showNotification } = useNotification();
    showNotification('', { variant: 'error', error: { error: 500, reason: 'errors.boom' } });
    flushSync();
    await tick();
    flushSync();

    expect(toastText()).toContain('errors.boom');
  });

  it('тост со строкой действий не гаснет сам', async () => {
    const spy = vi.spyOn(toast, 'error');
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });

    const { showNotification } = useNotification();
    showNotification('Замок не найден', {
      variant: 'error',
      error: { error: 404, reason: 'errors.lock_not_found' },
    });

    // Ошибка — единственный след случившегося, и по ней ещё надо кликнуть; дефолтные
    // 4с sonner её просто уносят.
    expect(spy.mock.calls[0][1]).toMatchObject({ duration: Number.POSITIVE_INFINITY });

    showNotification('Просто ошибка', { variant: 'error' });
    // Без error-объекта поведение прежнее — sonner сам решает, сколько держать.
    expect(spy.mock.calls[1][1]).not.toHaveProperty('duration');
    spy.mockRestore();
  });

  it('хост тостов кликабелен поверх модалки', async () => {
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });

    // <ol data-sonner-toaster> появляется только когда есть что показывать.
    const { showNotification } = useNotification();
    showNotification('Замок не найден', {
      variant: 'error',
      error: { error: 404, reason: 'errors.lock_not_found' },
    });
    flushSync();
    await tick();
    flushSync();

    // bits-ui на время модалки держит `pointer-events: none` на <body>, и тост,
    // живущий вне диалога, это наследует: виден, но не нажимается. Список тостов
    // возвращает себе события явно.
    const ol = document.querySelector('[data-sonner-toaster]');
    expect(ol?.className).toContain('pointer-events-auto');
  });

  it('нечисловой error-код не уезжает в HTTP-строку деталей', async () => {
    const onContactSupport = vi.fn();
    mountToaster({ onContactSupport, resolveErrorHelp: vi.fn().mockResolvedValue([]) });

    const { showNotification } = useNotification();
    // Meteor.Error('google-auth', ...) — код строкой, такие в коде сервера есть.
    showNotification('Сбой входа', {
      variant: 'error',
      error: { error: 'google-auth', reason: 'errors.google_failed' },
    });
    flushSync();
    await tick();
    flushSync();

    (byTestId('error-toast-support') as HTMLButtonElement).click();
    flushSync();
    expect(onContactSupport.mock.calls[0][0]).not.toContain('HTTP');
  });
});
