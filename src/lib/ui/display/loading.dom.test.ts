// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Loading from './Loading.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Loading, { target, props });
  flushSync();
  const wrapper = target.firstElementChild as HTMLElement;
  return { wrapper, svg: wrapper.querySelector('svg') as SVGElement };
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('Loading', () => {
  it('по умолчанию — блочный лоадер: занимает место флекс-родителя и держит отступы', () => {
    const { wrapper, svg } = setup();
    expect(wrapper.className).toContain('flex-1');
    expect(wrapper.className).toContain('p-8');
    expect(svg.getAttribute('class')).toContain('w-8');
  });

  it('size="sm" — строчный: без отступов, без flex-1, мелкий спиннер', () => {
    const { wrapper, svg } = setup({ size: 'sm' });
    expect(wrapper.className).not.toContain('p-8');
    expect(wrapper.className).not.toContain('flex-1');
    expect(svg.getAttribute('class')).toContain('w-4');
  });

  // Регрессия: до 0.9.11 `size` не был объявлен, оседал HTML-атрибутом на обёртке и не
  // менял ничего — `size="sm"` рисовался как блок 96px высотой и распирал строку списка.
  it('size не протекает в DOM атрибутом', () => {
    const { wrapper } = setup({ size: 'sm' });
    expect(wrapper.hasAttribute('size')).toBe(false);
  });

  it('неизвестное значение size откатывается на дефолт, а не роняет разметку', () => {
    const { wrapper, svg } = setup({ size: 'xl' });
    expect(wrapper.className).toContain('p-8');
    expect(svg.getAttribute('class')).toContain('w-8');
  });

  it('class потребителя доезжает до обёртки', () => {
    const { wrapper } = setup({ class: 'h-full' });
    expect(wrapper.className).toContain('h-full');
  });
});
