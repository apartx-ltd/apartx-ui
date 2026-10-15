// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet } from 'svelte';
import Item from './Item.svelte';

// `disabled` у Item: строка не кликается и не подсвечивается, ссылка не уводит. Раньше проп
// уходил в restProps атрибутом на div, а onclick оставался рабочим — хосты гасили клик руками.

const label = createRawSnippet(() => ({ render: () => '<span>Row</span>' }));
let disposers: Array<() => void> = [];

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Item as any, { target, props: { children: label, ...props } as any });
  flushSync();
  disposers.push(() => {
    unmount(handle);
    target.remove();
  });
  return target.firstElementChild as HTMLElement;
}

afterEach(() => {
  disposers.forEach((dispose) => dispose());
  disposers = [];
});

describe('Item disabled', () => {
  it('без disabled — клик доходит, строка интерактивна', () => {
    let clicks = 0;
    const row = render({ onclick: () => clicks++ });
    row.click();
    expect(clicks).toBe(1);
    expect(row.getAttribute('data-disabled')).toBeNull();
    expect(row.className).toContain('cursor-pointer');
  });

  it('disabled — клик не доходит, data-disabled, 38 % и без подсветки', () => {
    let clicks = 0;
    const row = render({ onclick: () => clicks++, disabled: true });
    row.click();
    expect(clicks).toBe(0);
    expect(row.getAttribute('data-disabled')).toBe('true');
    expect(row.className).toContain('opacity-38');
    expect(row.className).not.toContain('cursor-pointer');
    expect(row.hasAttribute('disabled')).toBe(false);
  });

  it('disabled со ссылкой — div без href', () => {
    const row = render({ href: '/somewhere', disabled: true });
    expect(row.tagName).toBe('DIV');
    expect(row.getAttribute('href')).toBeNull();
    expect(row.getAttribute('data-disabled')).toBe('true');
  });

  it('ссылка без disabled — по-прежнему <a href>', () => {
    const row = render({ href: '/somewhere' });
    expect(row.tagName).toBe('A');
    expect(row.getAttribute('href')).toBe('/somewhere');
  });
});
