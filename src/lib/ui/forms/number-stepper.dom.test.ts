// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './number-stepper.harness.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, { target, props });
  flushSync();
  return {
    dec: target.querySelector('[data-stepper="dec"]') as HTMLButtonElement,
    inc: target.querySelector('[data-stepper="inc"]') as HTMLButtonElement,
    out: () => (target.querySelector('[data-testid="out"]') as HTMLElement).textContent,
  };
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('NumberStepper', () => {
  it('показывает значение, «+» и «−» двигают его на шаг', () => {
    const { dec, inc, out } = setup();
    expect(out()).toBe('2');
    inc.click();
    flushSync();
    expect(out()).toBe('3');
    dec.click();
    dec.click();
    flushSync();
    expect(out()).toBe('1');
  });

  // Граница — гаснет кнопка, а не режется значение задним числом: иначе клик по краю
  // выглядит как «не сработало».
  it('на границах соответствующая кнопка выключена, значение не выходит за min/max', () => {
    const { dec, inc, out } = setup({ initial: 3 });
    expect(inc.disabled).toBe(true);
    expect(dec.disabled).toBe(false);
    inc.click();
    flushSync();
    expect(out()).toBe('3');
    dec.click();
    dec.click();
    flushSync();
    expect(out()).toBe('1');
    expect(dec.disabled).toBe(true);
  });

  it('disabled выключает обе кнопки', () => {
    const { dec, inc } = setup({ disabled: true });
    expect(dec.disabled).toBe(true);
    expect(inc.disabled).toBe(true);
  });

  it('restProps уходят на корень (data-testid)', () => {
    setup();
    expect(target.querySelector('[data-testid="stepper"]')).not.toBeNull();
  });
});
