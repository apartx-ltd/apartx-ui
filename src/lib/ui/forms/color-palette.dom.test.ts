// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import ColorPalette from './ColorPalette.svelte';
import Host from './__fixtures__/ColorPaletteHost.svelte';

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}, C: any = ColorPalette) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(C, { target, props: { value: null, defaultValue: '#003580', ...props } });
  flushSync();
}
const sw = (hex: string) => target.querySelector(`[data-swatch="${hex}"]`) as HTMLElement;
const q = (s: string) => target.querySelector(s) as HTMLElement | null;

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('ColorPalette', () => {
  it('renders 16 swatches, marks the current one', () => {
    setup({ value: '#1e88e5' });
    expect(target.querySelectorAll('[data-swatch]')).toHaveLength(16);
    expect(sw('#1e88e5').getAttribute('aria-pressed')).toBe('true');
    expect(sw('#9c27b0').getAttribute('aria-pressed')).toBeNull();
  });

  it('marks defaultValue when value is null', () => {
    setup();
    expect(sw('#003580').getAttribute('aria-pressed')).toBe('true');
  });

  it('emits a swatch click', () => {
    const onChange = vi.fn();
    setup({ onChange });
    sw('#1e88e5').click();
    flushSync();
    expect(onChange).toHaveBeenCalledWith('#1e88e5');
  });

  it('does not emit when the current swatch is clicked', () => {
    const onChange = vi.fn();
    setup({ value: '#1e88e5', onChange });
    sw('#1e88e5').click();
    sw('#1e88e5').click();
    flushSync();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows reset only when value differs from default', () => {
    const onChange = vi.fn();
    setup({ value: '#003580', onChange });
    expect(q('[data-color-reset]')).toBeNull();
    unmount(comp);
    target.remove();
    setup({ value: '#1e88e5', onChange });
    expect(q('[data-color-reset]')).not.toBeNull();
    q('[data-color-reset]')!.click();
    flushSync();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('treats an uppercase default as equal to its lowercase value', () => {
    setup({ value: '#003580', defaultValue: '#003580'.toUpperCase().replace('#', '#') });
    expect(q('[data-color-reset]')).toBeNull();
  });

  it('updates a bound value', () => {
    setup({}, Host);
    sw('#9c27b0').click();
    flushSync();
    expect(q('[data-testid="val"]')!.textContent).toBe('#9c27b0');
  });

  it('custom mode: normalizes hex input, rejects garbage', () => {
    const onChange = vi.fn();
    setup({ onChange });
    q('[data-color-custom]')!.click();
    flushSync();
    const hex = q('[data-color-hex]') as HTMLInputElement;
    hex.value = 'FF5A5F';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    hex.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();
    expect(onChange).toHaveBeenCalledWith('#ff5a5f');

    onChange.mockClear();
    hex.value = 'red';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    hex.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();
    expect(onChange).not.toHaveBeenCalled();
    expect(hex.classList.contains('text-error')).toBe(true);

    q('[data-color-back]')!.click();
    flushSync();
    expect(q('[data-color-hex]')).toBeNull();
  });
});
