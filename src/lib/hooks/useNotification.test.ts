// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import ToasterMount from '../ui/overlays/ToasterMount.svelte';
import { clearErrorHelpCache } from '../ui/overlays/error-toast';
import { stack, zForDepth } from '../modals/registry.svelte';
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

  it('тост ошибки не гаснет сам, success — гаснет', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const warnSpy = vi.spyOn(toast, 'warning');
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });

    const { showNotification } = useNotification();
    // Ошибка — часто единственный след случившегося; дефолтные 4с sonner её уносят.
    showNotification('Замок не найден', {
      variant: 'error',
      error: { error: 404, reason: 'errors.lock_not_found' },
    });
    expect(errorSpy.mock.calls[0][1]).toMatchObject({ duration: Number.POSITIVE_INFINITY });

    // Ещё не мигрированный call site (без error-объекта) — тоже висит: правило про
    // ошибку, а не про строку действий.
    showNotification('Просто ошибка', { variant: 'error' });
    expect(errorSpy.mock.calls[1][1]).toMatchObject({ duration: Number.POSITIVE_INFINITY });

    // Варнинг сам по себе гаснет, но со строкой действий по нему надо успеть кликнуть.
    showNotification('Внимание', { variant: 'warning' });
    expect(warnSpy.mock.calls[0][1]).not.toHaveProperty('duration');
    showNotification('Внимание', {
      variant: 'warning',
      error: { error: 409, reason: 'errors.already_claimed' },
    });
    expect(warnSpy.mock.calls[1][1]).toMatchObject({ duration: Number.POSITIVE_INFINITY });

    errorSpy.mockRestore();
    warnSpy.mockRestore();
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

  it('тост встаёт над стеком модалок, каким тот был в момент показа', async () => {
    // Смысл правила: ошибка ИЗ модалки видна поверх неё, но статья, открытая по
    // «Почему?» этого же тоста, ложится ПОВЕРХ тоста — она уходит на следующую
    // ступень стека. Дефолт sonner (999999999) не дал бы ни того, ни другого.
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });
    const { showNotification } = useNotification();
    const olZ = () =>
      (document.querySelector('[data-sonner-toaster]') as HTMLElement)?.style.zIndex;

    // Стек пуст: выше дефолтного контента Dialog (z-50), ниже базы реестра (60).
    showNotification('Первая', { variant: 'error', error: { reason: 'errors.a' } });
    flushSync();
    await tick();
    flushSync();
    expect(olZ()).toBe('55');

    // Модалка открыта (depth 0 → scrim 60 / контент 61) — тост поверх неё.
    stack.push({ key: 1, id: 'x', props: {}, resolve: () => {} } as any);
    showNotification('Вторая', { variant: 'error', error: { reason: 'errors.b' } });
    flushSync();
    await tick();
    flushSync();
    expect(olZ()).toBe(String(zForDepth(0) + 2));

    // Открытая ПОСЛЕ тоста модалка (depth 1 → 70/71) перекрывает его: z хоста
    // снят в момент тоста и за стеком не бежит.
    stack.push({ key: 2, id: 'y', props: {}, resolve: () => {} } as any);
    flushSync();
    expect(Number(olZ())).toBeLessThan(zForDepth(1));

    stack.length = 0;
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
