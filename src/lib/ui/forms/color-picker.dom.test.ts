// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import ColorPicker from './ColorPicker.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  const state: Record<string, any> = { value: null, defaultValue: '#003580', open: true, ...props };
  comp = mount(ColorPicker, { target, props: state as any });
  flushSync();
  return state;
}
const body = (s: string) => document.body.querySelector(s) as HTMLElement | null;
const wait = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
  document.body.innerHTML = '';
});

describe('ColorPicker', () => {
  it('trigger shows defaultValue when value is null', () => {
    setup({ open: false });
    expect(body('[data-color-trigger]')!.style.background).toContain('rgb(0, 53, 128)');
  });

  it('renders the palette inside the popover when open', () => {
    setup();
    expect(body('[data-color-palette]')).not.toBeNull();
  });

  it('closes after a swatch click and emits', async () => {
    const onChange = vi.fn();
    setup({ onChange });
    body('[data-swatch="#1e88e5"]')!.click();
    await wait();
    flushSync();
    expect(onChange).toHaveBeenCalledWith('#1e88e5');
    expect(body('[data-color-palette]')).toBeNull();
  });

  it('closes on the current swatch without emitting', async () => {
    const onChange = vi.fn();
    setup({ onChange, value: '#1e88e5' });
    body('[data-swatch="#1e88e5"]')!.click();
    await wait();
    flushSync();
    expect(onChange).not.toHaveBeenCalled();
    expect(body('[data-color-palette]')).toBeNull();
  });

  it('closes after reset', async () => {
    const onChange = vi.fn();
    setup({ onChange, value: '#1e88e5' });
    body('[data-color-reset]')!.click();
    await wait();
    flushSync();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(body('[data-color-palette]')).toBeNull();
  });

  it('passes restProps to the trigger', () => {
    setup({ open: false, 'data-testid': 'x' });
    expect(body('[data-color-trigger][data-testid="x"]')).not.toBeNull();
  });

  it('field variant shows label, hex and the default mark', () => {
    setup({ open: false, variant: 'field', label: 'Color' });
    const root = body('[data-color-picker]')!;
    expect(root.textContent).toContain('Color');
    expect(root.textContent).toContain('#003580');
    expect(root.textContent).toContain('default');
    unmount(comp);
    target.remove();
    setup({ open: false, variant: 'field', label: 'Color', value: '#1e88e5' });
    const t = body('[data-color-picker]')!.textContent!;
    expect(t).toContain('#1e88e5');
    expect(t).not.toContain('default');
  });

  it('field variant renders the error text', () => {
    setup({ open: false, variant: 'field', label: 'Color', error: 'Required' });
    const err = [...document.body.querySelectorAll('.text-error')].find((e) => e.textContent === 'Required');
    expect(err).toBeTruthy();
  });
});
