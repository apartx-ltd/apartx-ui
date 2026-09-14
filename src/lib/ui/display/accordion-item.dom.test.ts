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
  it('по умолчанию — обычный заголовок без иконки предупреждения', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('Photos');
    expect(trigger.className).not.toContain('text-error');
    // Только шеврон.
    expect(trigger.querySelectorAll('svg').length).toBe(1);
    expect(target.querySelector('[data-error]')).toBeNull();
  });

  // Незаполненная секция должна читаться в свёрнутом виде: цвет и иконка — на заголовке,
  // а не в теле, которое скрыто, пока секция закрыта.
  it('error — красный заголовок с иконкой предупреждения, виден в свёрнутом виде', () => {
    const { trigger } = setup({ error: true });
    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(trigger.className).toContain('text-error');
    expect(trigger.className).not.toContain('text-on-surface ');
    expect(trigger.querySelectorAll('svg').length).toBe(2);
    expect(target.querySelector('[data-error]')).not.toBeNull();
  });
});
