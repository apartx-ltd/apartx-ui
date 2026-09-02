// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import ToasterMount from './ToasterMount.svelte';
import { clearErrorHelpCache } from './error-toast';
import ErrorToastActions from './ErrorToastActions.svelte';

// Самое хрупкое место связки: <ErrorToastActions> рендерит НЕ консьюмер, а svelte-sonner —
// как `description`-компонент внутри своего дерева. Контекст с хендлерами ставит
// <ToasterMount> у себя в init, и вся фича держится на том, что тост оказывается его
// потомком. Если sonner когда-нибудь начнёт монтировать тосты в отдельное дерево/портал,
// getToasterHandlers() вернёт undefined и кнопки тихо исчезнут — эти тесты про это.

// jsdom не реализует matchMedia, а <Toaster> читает prefers-color-scheme в $effect
// (как ResizeObserver в virtual/cache-shape.test.ts — тем же способом и глушим).
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

const target = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
};

let mounted: any[] = [];

function mountToaster(props: Record<string, unknown>) {
  const handle = mount(ToasterMount as any, { target: target(), props: props as any });
  mounted.push(handle);
  flushSync();
  return handle;
}

/** Тост с нашей строкой действий — ровно так его ставит useNotification. */
function fireErrorToast(message: string, componentProps: Record<string, unknown>) {
  toast.error(message, { description: ErrorToastActions as any, componentProps } as any);
  flushSync();
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const byTestId = (id: string) =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

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

describe('ErrorToastActions внутри ToasterMount', () => {
  it('хендлеры из пропов ToasterMount доезжают до тоста контекстом', async () => {
    const resolveErrorHelp = vi.fn().mockResolvedValue([{ slug: 'why-lock', title: 'Why' }]);
    const onOpenArticle = vi.fn();
    mountToaster({ resolveErrorHelp, onOpenArticle, onContactSupport: vi.fn() });

    fireErrorToast('Замок не найден', { errorKey: 'errors.lock_not_found', httpCode: 404 });
    await tick();
    flushSync();

    expect(resolveErrorHelp).toHaveBeenCalledWith('errors.lock_not_found', 'en');
    expect(byTestId('error-toast-why')).toBeTruthy();

    byTestId('error-toast-why')!.click();
    flushSync();
    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'why-lock', title: 'Why' });
  });

  it('при нескольких статьях «Почему?» даёт выбрать, а не решает за пользователя', async () => {
    const onOpenArticle = vi.fn();
    mountToaster({
      resolveErrorHelp: vi.fn().mockResolvedValue([
        { slug: 'first', title: 'Первая' },
        { slug: 'second', title: 'Вторая' },
      ]),
      onOpenArticle,
    });

    fireErrorToast('Ошибка', { errorKey: 'errors.many', httpCode: 400 });
    await tick();
    flushSync();

    // Порядок статей задаёт база — открывать первую молча значит выбирать вслепую.
    expect(document.querySelectorAll('[data-testid="error-toast-article"]')).toHaveLength(0);

    // Кликаем сам триггер попапа (bits-ui вешает обработчик на свою кнопку-обёртку).
    byTestId('error-toast-why')!.closest('button')!.click();
    await tick();
    flushSync();

    const items = [...document.querySelectorAll('[data-testid="error-toast-article"]')];
    expect(items.map((el) => el.textContent)).toEqual(['Первая', 'Вторая']);
    expect(onOpenArticle).not.toHaveBeenCalled();

    (items[1] as HTMLButtonElement).click();
    await tick();
    flushSync();
    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'second', title: 'Вторая' });
  });

  it('единственная статья открывается сразу, без меню', async () => {
    const onOpenArticle = vi.fn();
    mountToaster({
      resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 'only', title: 'Одна' }]),
      onOpenArticle,
    });

    fireErrorToast('Ошибка', { errorKey: 'errors.one', httpCode: 400 });
    await tick();
    flushSync();

    // Лишний клик ни за чем: выбирать не из чего — сразу открываем.
    byTestId('error-toast-why')!.click();
    flushSync();

    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'only', title: 'Одна' });
    expect(document.querySelectorAll('[data-testid="error-toast-article"]')).toHaveLength(0);
  });

  it('без попадания кнопки «Почему?» нет, копирование остаётся', async () => {
    mountToaster({
      resolveErrorHelp: vi.fn().mockResolvedValue([]),
      onOpenArticle: vi.fn(),
      onContactSupport: vi.fn(),
    });

    fireErrorToast('Что-то пошло не так', { errorKey: 'errors.no_article', httpCode: 500 });
    await tick();
    flushSync();

    expect(byTestId('error-toast-why')).toBeNull();
    expect(byTestId('error-toast-copy')).toBeTruthy();
    expect(byTestId('error-toast-support')).toBeTruthy();
  });

  it('без resolveErrorHelp транспорт не зовётся, тост живёт', async () => {
    mountToaster({ onContactSupport: vi.fn() });

    fireErrorToast('Ошибка', { errorKey: 'errors.x', httpCode: 400 });
    await tick();
    flushSync();

    expect(byTestId('error-toast-why')).toBeNull();
    expect(byTestId('error-toast-copy')).toBeTruthy();
  });

  it('«В саппорт» отдаёт собранный блок деталей', async () => {
    const onContactSupport = vi.fn();
    mountToaster({
      onContactSupport,
      detailsContext: () => ({ user: 'u1', build: '1.2.3' }),
      resolveErrorHelp: vi.fn().mockResolvedValue([]),
    });

    fireErrorToast('Замок не найден', { errorKey: 'errors.lock_not_found', httpCode: 404, message: 'Замок не найден' });
    await tick();
    flushSync();

    byTestId('error-toast-support')!.click();
    flushSync();

    expect(onContactSupport).toHaveBeenCalledTimes(1);
    const text = onContactSupport.mock.calls[0][0] as string;
    expect(text.split('\n')[0]).toBe('errors.lock_not_found · HTTP 404');
    expect(text).toContain('Замок не найден');
    expect(text).toContain('user u1 · build 1.2.3');
  });

  it('на время статьи хост тостов ныряет под модалки и возвращается', async () => {
    // Дефолт sonner — z поверх всего, и это правильно: ошибка чаще всего прилетает из
    // открытой модалки. Но статью из «Почему?» надо читать, а не разглядывать из-под
    // тоста, поэтому на время её показа хост уходит вниз — и только на это время.
    let close!: () => void;
    const onOpenArticle = vi.fn(() => new Promise<void>((r) => { close = r; }));
    mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 's', title: 't' }]), onOpenArticle });

    fireErrorToast('Ошибка', { errorKey: 'errors.z', httpCode: 400 });
    await tick();
    flushSync();

    const olZ = () => (document.querySelector('[data-sonner-toaster]') as HTMLElement).style.zIndex;
    expect(olZ()).toBe('');

    byTestId('error-toast-why')!.click();
    await tick();
    flushSync();
    // Ниже базы реестра модалок (60) — статья ляжет сверху.
    expect(Number(olZ())).toBeLessThan(60);

    close();
    await tick();
    flushSync();
    expect(olZ()).toBe('');
  });

  it('«Скопировать» работает без navigator.clipboard (не-secure context)', async () => {
    // Дев-инстансы отдаются по http://<host>:<port>, где navigator.clipboard просто нет —
    // прямой writeText бросал, и кнопка молча ничего не делала (репорт 2026-09-02).
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as any).execCommand = exec;

    try {
      mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });
      fireErrorToast('Замок не найден', { errorKey: 'errors.lock_not_found', httpCode: 404 });
      await tick();
      flushSync();

      byTestId('error-toast-copy')!.click();
      await tick();
      flushSync();

      expect(exec).toHaveBeenCalledWith('copy');
      expect(byTestId('error-toast-copy')!.textContent).toBe('Copied');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      delete (document as any).execCommand;
    }
  });

  it('отказ копирования виден подписью, а не молчанием', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    (document as any).execCommand = vi.fn().mockReturnValue(false);

    try {
      mountToaster({ resolveErrorHelp: vi.fn().mockResolvedValue([]) });
      fireErrorToast('Замок не найден', { errorKey: 'errors.lock_not_found', httpCode: 404 });
      await tick();
      flushSync();

      byTestId('error-toast-copy')!.click();
      await tick();
      flushSync();

      expect(byTestId('error-toast-copy')!.textContent).toBe('Copy failed');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      delete (document as any).execCommand;
    }
  });

  it('подписи берутся из labels консьюмера', async () => {
    mountToaster({
      resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 's', title: 't' }]),
      onOpenArticle: vi.fn(),
      onContactSupport: vi.fn(),
      labels: { why: 'Почему?', copy: 'Скопировать', support: 'В саппорт' },
    });

    fireErrorToast('Ошибка', { errorKey: 'errors.y', httpCode: 400 });
    await tick();
    flushSync();

    expect(byTestId('error-toast-why')!.textContent).toBe('Почему?');
    expect(byTestId('error-toast-copy')!.textContent).toBe('Скопировать');
    expect(byTestId('error-toast-support')!.textContent).toBe('В саппорт');
  });

  it('смена языка на лету переписывает подписи висящего тоста', async () => {
    // Ради этого хендлеры лежат в контексте геттером: <ToasterMount> монтируется в корне
    // приложения один раз, и снимок labels остался бы на языке момента монтирования.
    let lang = $state('en');
    const labelsFor = () => (lang === 'ru'
      ? { why: 'Почему?', copy: 'Скопировать' }
      : { why: 'Why?', copy: 'Copy details' });

    const handle = mount(ToasterMount as any, {
      target: target(),
      props: {
        get labels() { return labelsFor(); },
        resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 's', title: 't' }]),
        onOpenArticle: vi.fn(),
      } as any,
    });
    mounted.push(handle);
    flushSync();

    fireErrorToast('Ошибка', { errorKey: 'errors.z', httpCode: 400 });
    await tick();
    flushSync();
    expect(byTestId('error-toast-why')!.textContent).toBe('Why?');

    lang = 'ru';
    flushSync();
    expect(byTestId('error-toast-why')!.textContent).toBe('Почему?');
    expect(byTestId('error-toast-copy')!.textContent).toBe('Скопировать');
  });

  it('без errorKey строки действий нет вообще', async () => {
    mountToaster({ resolveErrorHelp: vi.fn(), onContactSupport: vi.fn() });

    fireErrorToast('Просто ошибка', { errorKey: null });
    await tick();
    flushSync();

    expect(byTestId('error-toast-copy')).toBeNull();
  });
});
