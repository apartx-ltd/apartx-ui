// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/InlineErrorHost.svelte';
import ToasterMount from './ToasterMount.svelte';
import { clearErrorHelpCache } from './error-toast';
import { toastLayer } from './toaster-context.svelte';

// Инлайн-ошибка живёт вне дерева тостера, а хендлеры берёт из того же контекста, что тост.
// Поэтому и монтируется через хост-компонент: контекст ставится только в init родителя.

const target = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

let mounted: any[] = [];
function mountHost(props: Record<string, unknown>) {
  const h = mount(Host as any, { target: target(), props: props as any });
  mounted.push(h);
  flushSync();
  return h;
}

beforeEach(() => {
  // jsdom не умеет matchMedia, а <Toaster> из svelte-sonner читает его в $effect —
  // без заглушки <ToasterMount> не смонтировать.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as any;
  }
  clearErrorHelpCache();
  document.body.innerHTML = '';
  mounted = [];
});
afterEach(() => {
  for (const h of mounted) { try { unmount(h); } catch { /* уже размонтирован */ } }
  document.body.innerHTML = '';
});

describe('InlineError', () => {
  it('под хендлерами: по reason появляется «Почему?», клик открывает статью, хост тостов НЕ ныряет', async () => {
    const onOpenArticle = vi.fn(() => new Promise<void>(() => { /* статья открыта */ }));
    mountHost({
      handlers: { resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 'blocked', title: 'Blocked' }]), onOpenArticle },
      error: { reason: 'accounts.errors.max_retry_blocked', error: 429 },
      text: 'Заблокировано на час',
    });
    await tick();
    flushSync();

    const root = byTestId('inline')!;
    expect(root.getAttribute('role')).toBe('alert');
    expect(root.textContent).toContain('Заблокировано на час');
    byTestId('error-toast-why')!.click();
    await tick();
    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'blocked', title: 'Blocked' });
    // Инлайн живёт не в тосте — хосту тостов нырять не от чего.
    expect(toastLayer.z).toBeNull();
  });

  it('<ToasterMount> смонтирован рядом, а не выше по дереву: хендлеры всё равно доезжают', async () => {
    // Именно так и стоит приложение: <ToasterMount> — сосед страницы в корне, и его
    // setContext видят только тосты sonner. Инлайновая ошибка живёт в форме, поэтому
    // хендлеры берутся модулем; без него оставалась одна «Скопировать».
    const onOpenArticle = vi.fn();
    const mount1 = mount(ToasterMount as any, {
      target: target(),
      props: {
        resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 'blocked', title: 'Blocked' }]),
        onOpenArticle,
        onContactSupport: vi.fn(),
      } as any,
    });
    mounted.push(mount1);
    flushSync();

    mountHost({ error: { reason: 'accounts.errors.max_retry_blocked' }, text: 'Заблокировано' });
    await tick();
    flushSync();

    expect(byTestId('error-toast-why')).not.toBeNull();
    expect(byTestId('error-toast-support')).not.toBeNull();
    byTestId('error-toast-why')!.click();
    await tick();
    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'blocked', title: 'Blocked' });
  });

  it('без хендлеров (нет ToasterMount): только текст, кнопок нет, консоль чистая', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mountHost({ error: { reason: 'errors.x' }, text: 'Ошибка' });
    expect(byTestId('inline')!.textContent).toContain('Ошибка');
    expect(byTestId('error-toast-why')).toBeNull();
    expect(byTestId('error-toast-support')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('reason не по форме ключа: «Почему?» нет, копирование и саппорт есть', async () => {
    const resolveErrorHelp = vi.fn();
    mountHost({
      handlers: { resolveErrorHelp, onContactSupport: vi.fn() },
      error: { reason: 'Not a valid code' },
      text: 'Неверный код',
    });
    await tick();
    flushSync();
    expect(resolveErrorHelp).not.toHaveBeenCalled();
    expect(byTestId('error-toast-why')).toBeNull();
    expect(byTestId('error-toast-copy')).not.toBeNull();
    expect(byTestId('error-toast-support')).not.toBeNull();
  });

  it('error=null — текст без действий; без error и без слота — пустой рендер', () => {
    mountHost({ handlers: { resolveErrorHelp: vi.fn() }, error: null, text: 'Пароли не совпадают' });
    expect(byTestId('inline')!.textContent).toContain('Пароли не совпадают');
    expect(byTestId('error-toast-copy')).toBeNull();

    document.body.innerHTML = '';
    mountHost({ handlers: { resolveErrorHelp: vi.fn() }, error: null, text: '' });
    expect(byTestId('inline')).toBeNull();
  });
});
