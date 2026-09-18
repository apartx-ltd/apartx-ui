// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './callout.harness.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, { target, props });
  flushSync();
  return { root: target.firstElementChild as HTMLElement };
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('Callout', () => {
  it('по умолчанию — тон primary: заливка container и контрастный on-container', () => {
    const { root } = setup();
    expect(root.className).toContain('bg-primary-container');
    expect(root.className).toContain('text-on-primary-container');
    expect(root.dataset.tone).toBe('primary');
  });

  it('заголовок — h3 с ролью group-title, цвет наследует тон', () => {
    const { root } = setup();
    const h3 = root.querySelector('h3') as HTMLElement;
    expect(h3.textContent).toContain('Sign the contract');
    expect(h3.className).toContain('text-group-title');
    expect(h3.className).toContain('text-inherit');
  });

  it('тело — роль hint с наследуемым цветом', () => {
    const { root } = setup();
    const body = root.querySelector('.text-hint') as HTMLElement;
    expect(body.textContent).toContain('You need to sign the contract.');
    expect(body.className).toContain('text-inherit');
  });

  it('tone="error" — заливка error-container', () => {
    const { root } = setup({ tone: 'error' });
    expect(root.className).toContain('bg-error-container');
    expect(root.className).not.toContain('bg-primary-container');
  });

  it('неизвестный тон откатывается на primary, а не оставляет плашку без заливки', () => {
    const { root } = setup({ tone: 'warning' });
    expect(root.className).toContain('bg-primary-container');
  });

  it('иконка и действия рендерятся только когда переданы', () => {
    const bare = setup();
    expect(bare.root.querySelector('svg')).toBeNull();
    expect(bare.root.querySelector('[data-testid="slot-action"]')).toBeNull();
    unmount(comp);
    comp = null;
    target.remove();

    const full = setup({ withIcon: true, withActions: true });
    expect(full.root.querySelector('svg')).not.toBeNull();
    expect(full.root.querySelector('[data-testid="slot-action"]')).not.toBeNull();
  });

  it('заголовок-сниппет рендерится как разметка', () => {
    const { root } = setup({ snippetTitle: true });
    expect(root.querySelector('h3 [data-testid="slot-title"]')).not.toBeNull();
  });

  it('без заголовка и иконки строка заголовка не рендерится', () => {
    const { root } = setup({ title: '' });
    expect(root.querySelector('h3')).toBeNull();
    expect(root.children.length).toBe(1);
  });

  it('data-testid и прочие атрибуты доходят до корня', () => {
    const { root } = setup({ 'data-testid': 'booking-callout', role: 'status' });
    expect(root.dataset.testid).toBe('booking-callout');
    expect(root.getAttribute('role')).toBe('status');
  });
});
