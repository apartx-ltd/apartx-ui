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

  it('subtitle — вторая строка в заголовке, видна в свёрнутом виде', () => {
    const { trigger } = setup({ subtitle: 'Paid 10 000 of 10 000' });
    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(trigger.querySelector('[data-accordion-subtitle]')?.textContent?.trim()).toBe('Paid 10 000 of 10 000');
  });

  // Секция без содержимого не должна притворяться раскрывающейся: ни кнопки, ни шеврона, ни тела.
  it('expandable=false — статичная строка: без кнопки, шеврона и тела', () => {
    setup({ expandable: false, subtitle: 'Confirmed', withSlots: true });
    const row = target.querySelector('[data-expandable="false"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(target.querySelector('button')).toBeNull();
    expect(row.querySelectorAll('svg').length).toBe(0);
    expect(row.textContent).toMatch(/S\s*Photos\s*Confirmed\s*3/);
    expect(row.textContent).not.toContain('Body');
  });
});
