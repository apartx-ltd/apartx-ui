// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './accordion-item.harness.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, { target, props });
  flushSync();
  return { trigger: target.querySelector('button') as HTMLButtonElement };
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('AccordionItem', () => {
  it('по умолчанию — строка-заголовок и шеврон, без слотов и предупреждения', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('Photos');
    expect(trigger.className).not.toContain('text-error');
    expect(trigger.querySelectorAll('svg').length).toBe(1);
    expect(target.querySelector('[data-error]')).toBeNull();
  });

  // Незаполненная секция должна читаться в свёрнутом виде: цвет и иконка — на заголовке,
  // а не в теле, которое скрыто, пока секция закрыта.
  it('error — красный заголовок с иконкой предупреждения, виден в свёрнутом виде', () => {
    const { trigger } = setup({ error: true });
    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(trigger.className).toContain('text-error');
    expect(trigger.querySelectorAll('svg').length).toBe(2);
    expect(target.querySelector('[data-error]')).not.toBeNull();
  });

  it('start и end рендерятся в заголовке по порядку: start, заголовок, end, шеврон', () => {
    const { trigger } = setup({ withSlots: true });
    const startEl = trigger.querySelector('[data-testid="slot-start"]')!;
    const endEl = trigger.querySelector('[data-testid="slot-end"]')!;
    expect(startEl).not.toBeNull();
    expect(endEl).not.toBeNull();
    const chevron = trigger.querySelector('svg')!;
    expect(startEl.compareDocumentPosition(endEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(endEl.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger.textContent).toMatch(/S\s*Photos\s*3/);
  });

  it('title сниппетом рендерится разметкой, а не текстом функции', () => {
    const { trigger } = setup({ snippetTitle: true });
    expect(trigger.querySelector('[data-testid="slot-title"] small')?.textContent).toBe('of the property');
    expect(trigger.textContent).not.toContain('=>');
  });
});
