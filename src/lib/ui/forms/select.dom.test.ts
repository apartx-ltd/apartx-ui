// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Select from './Select.svelte';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Select, { target, props: { options: OPTIONS, value: 'a', ...props } });
  flushSync();
  return { clear: () => target.querySelector('[data-select-clear]') as HTMLElement | null };
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('Select clear button', () => {
  it('is hidden by default', () => {
    const { clear } = setup();
    expect(clear()).toBeNull();
  });

  it('is shown with clearable and a value', () => {
    const { clear } = setup({ clearable: true });
    expect(clear()).not.toBeNull();
  });

  it('is hidden with clearable but no value', () => {
    const { clear } = setup({ clearable: true, value: '' });
    expect(clear()).toBeNull();
  });

  it('is hidden on a disabled field even with clearable', () => {
    const { clear } = setup({ clearable: true, disabled: true });
    expect(clear()).toBeNull();
  });

  it('clears the value and reports it through onchange', () => {
    const seen: unknown[] = [];
    const { clear } = setup({ clearable: true, onchange: (e: any) => seen.push(e.target.value) });
    clear()!.click();
    flushSync();
    expect(seen).toEqual(['']);
    expect(target.textContent).not.toContain('Alpha');
  });
});
