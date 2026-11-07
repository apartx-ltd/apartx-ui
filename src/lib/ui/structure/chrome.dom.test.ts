// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/ChromeHost.svelte';

// Хром хоста (setHostChrome): ✕ хоста рисует первый по рангу Toolbar каждой Page (в Header —
// старше обычного), BackButton в нём прячется в корне панели (getBackVisibility → false).
// Тулбары в оверлеях, Footer и вне Page не претендуют; без setHostChrome всё как раньше.

let handle: any = null;

afterEach(() => {
  if (handle) unmount(handle);
  handle = null;
  document.body.innerHTML = '';
});

function mountHost(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  handle = mount(Host as any, { target, props });
  flushSync();
  return handle;
}

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const hasX = (id: string) => !!q(id)?.querySelector('[data-testid="host-x"]');
const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('host chrome', () => {
  it('без setHostChrome тулбары не меняются, BackButton виден', () => {
    mountHost({ second: true, backVisible: false });
    expect(document.querySelector('[data-testid="host-x"]')).toBeNull();
    expect(q('back-top')).toBeTruthy();
    expect(q('back-second')).toBeTruthy();
    // Разметка как до хрома: start, content, end — три обёртки, в end только своё.
    const top = q('top')!;
    expect(top.children.length).toBe(3);
    const endWrap = top.children[2] as HTMLElement;
    expect(endWrap.children.length).toBe(1);
    expect(endWrap.firstElementChild!.getAttribute('data-testid')).toBe('own-end');
    // Тулбар без end — без обёртки end.
    expect(stripComments(q('second')!.innerHTML)).not.toContain('shrink-0 flex items-center"');
    expect(q('second')!.children.length).toBe(1);
  });

  it('с хромом ✕ рисует первый тулбар страницы, второй — нет', () => {
    mountHost({ chrome: true, second: true });
    expect(hasX('top')).toBe(true);
    expect(hasX('second')).toBe(false);
    expect(document.querySelectorAll('[data-testid="host-x"]').length).toBe(1);
    // ✕ — после своего end, в той же обёртке.
    const endWrap = q('own-end')!.parentElement!;
    expect(endWrap.lastElementChild!.getAttribute('data-testid')).toBe('host-x');
  });

  it('с хромом тулбар без своего end получает обёртку end под ✕', () => {
    mountHost({ chrome: true, showTop: false, second: true });
    expect(hasX('second')).toBe(true);
  });

  it('тулбар в Header забирает ✕ у нижнего, даже если смонтирован позже', () => {
    const h = mountHost({ chrome: true, header: true, showTop: false, second: true });
    expect(hasX('second')).toBe(true);
    h.setShowTop(true);
    flushSync();
    expect(hasX('top')).toBe(true);
    expect(hasX('second')).toBe(false);
  });

  it('тулбар в Dialog, Footer и вне Page ✕ не рисует; Page внутри Dialog наследует запрет', () => {
    mountHost({ chrome: true, showTop: false, dialog: true, nested: true, footer: true, outsidePage: true });
    expect(q('dialog')).toBeTruthy();
    expect(q('nested')).toBeTruthy();
    expect(q('footer')).toBeTruthy();
    expect(q('outside')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="host-x"]').length).toBe(0);
  });

  it('BackButton без href в тулбаре-владельце скрыт при ложной видимости и виден при истинной', () => {
    mountHost({ chrome: true, second: true, backVisible: false });
    expect(q('back-top')).toBeNull();
    expect(q('back-second')).toBeTruthy();
    unmount(handle);
    handle = null;
    document.body.innerHTML = '';
    mountHost({ chrome: true, backVisible: true });
    expect(q('back-top')).toBeTruthy();
  });

  it('BackButton с href, и BackButton в диалоге — видимы при ложной видимости', () => {
    mountHost({ chrome: true, backVisible: false, backHref: '/up' });
    expect(q('back-top')).toBeTruthy();
    unmount(handle);
    handle = null;
    document.body.innerHTML = '';
    mountHost({ chrome: true, showTop: false, dialog: true, nested: true, backVisible: false });
    expect(q('back-dialog')).toBeTruthy();
    expect(q('back-nested')).toBeTruthy();
  });

  it('после размонтирования владельца ✕ переходит к следующему тулбару', () => {
    const h = mountHost({ chrome: true, second: true, backVisible: false });
    expect(hasX('top')).toBe(true);
    expect(q('back-second')).toBeTruthy();
    h.setShowTop(false);
    flushSync();
    expect(q('top')).toBeNull();
    expect(hasX('second')).toBe(true);
    expect(q('back-second')).toBeNull();
  });
});
