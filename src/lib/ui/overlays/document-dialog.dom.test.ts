// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/DocumentDialogHost.svelte';

// Читалка документа — презентационная: три состояния тела (loading / error+retry / html)
// и кнопка скачивания со спиннером. Данные и их загрузку ведёт хост (TanStack), здесь их нет.
// Вёрстку и скролл держат e2e консьюмеров.

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Микротаски + перерисовка: промис ondownload резолвится асинхронно, DOM — после flushSync.
const settle = async () => {
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};

let mounted: any[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
  mounted = [];
});
afterEach(() => {
  for (const handle of mounted) {
    try { unmount(handle); } catch { /* уже размонтирован */ }
  }
  document.body.innerHTML = '';
});

type HostProps = {
  html?: string;
  loading?: boolean;
  error?: boolean;
  onretry?: () => void;
  ondownload?: () => Promise<void>;
};

function mountHost(props: HostProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Host as any, { target, props });
  mounted.push(handle);
  flushSync();
  return handle;
}

describe('DocumentDialog', () => {
  it('loading — спиннер, тела нет', () => {
    mountHost({ loading: true, html: '<p>stale</p>' });
    expect(byTestId('document-dialog')).toBeTruthy();
    expect(byTestId('document-dialog-body')).toBeNull();
    expect(byTestId('document-dialog-error')).toBeNull();
  });

  it('error — текст ошибки, «Повторить» зовёт onretry', () => {
    const onretry = vi.fn();
    mountHost({ error: true, onretry });
    expect(byTestId('document-dialog-error')!.textContent).toContain('Failed');
    expect(byTestId('document-dialog-body')).toBeNull();

    byTestId('document-dialog-retry')!.click();
    expect(onretry).toHaveBeenCalledTimes(1);
  });

  it('html — в теле как есть (кит не санитизирует)', () => {
    mountHost({ html: '<p data-x="1">hello</p>' });
    expect(byTestId('document-dialog-body')!.innerHTML).toContain('<p data-x="1">hello</p>');
  });

  it('ondownload: кнопка заблокирована, пока промис висит; без ondownload кнопки нет', async () => {
    const d = deferred<void>();
    const ondownload = vi.fn(() => d.promise);
    mountHost({ html: '<p>x</p>', ondownload });
    const button = byTestId('document-dialog-download') as HTMLButtonElement;
    expect(button).toBeTruthy();

    button.click();
    await settle();
    expect(ondownload).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    d.resolve();
    await settle();
    expect(button.disabled).toBe(false);

    document.body.innerHTML = '';
    mountHost({ html: '<p>x</p>' });
    expect(byTestId('document-dialog-download')).toBeNull();
  });
});
