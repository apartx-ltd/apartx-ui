// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/PageHost.svelte';
import { safeTopFlow, safeTopStrip, safeBottomFlow } from '../utils/safe-area';

// Page забирает safe-area инсеты сам (0.16.0). `edgeToEdge` — opt-out для экранов, которые
// красят области под статус-баром и над home indicator своим содержимым (тёмная шапка на
// подложке, лист до нижнего края): Page не отступает и не обнуляет переменные детям.

let handle: any = null;

afterEach(() => {
  if (handle) unmount(handle);
  handle = null;
  document.body.innerHTML = '';
});

function mountPage(props: { edgeToEdge?: boolean; class?: string }) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  handle = mount(Host as any, { target, props });
  flushSync();
  return document.querySelector('[data-testid="page"]') as HTMLElement;
}

const insetClasses = [safeTopFlow, safeTopStrip, safeBottomFlow].flatMap((c) => c.split(' '));

describe('Page safe-area', () => {
  it('по умолчанию отступает на оба инсета и красит полоску под статус-баром', () => {
    const page = mountPage({});
    for (const cls of insetClasses) expect(page.classList.contains(cls)).toBe(true);
    expect(page.hasAttribute('data-edge-to-edge')).toBe(false);
  });

  it('edgeToEdge: ни отступов, ни полоски, ни обнуления переменных детям', () => {
    const page = mountPage({ edgeToEdge: true });
    for (const cls of insetClasses) expect(page.classList.contains(cls)).toBe(false);
    expect(page.hasAttribute('data-edge-to-edge')).toBe(true);
  });

  it('edgeToEdge: вертикальный padding хоста остаётся — инсет хост отбивает сам', () => {
    const page = mountPage({ edgeToEdge: true, class: 'bg-underlay pt-[calc(var(--safe-area-inset-top,0px)+0.5rem)]' });
    expect(page.classList.contains('pt-[calc(var(--safe-area-inset-top,0px)+0.5rem)]')).toBe(true);
    expect(page.classList.contains('bg-underlay')).toBe(true);
  });
});
