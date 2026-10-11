// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Select from './Select.svelte';
import Host from './__fixtures__/SelectHost.svelte';

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

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = async () => {
  flushSync();
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};
const options = () => Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
const ptr = { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' };
// bits выбирает строку по pointerup — настоящий жест, а не одиночный click.
function press(el: HTMLElement) {
  el.dispatchEvent(new PointerEvent('pointerdown', ptr));
  el.dispatchEvent(new PointerEvent('pointerup', ptr));
  el.dispatchEvent(new MouseEvent('click', ptr));
}
// jsdom: bits открывает триггер по pointerdown (левая кнопка, не touch); pointer capture в jsdom нет.
const proto = Element.prototype as any;
proto.hasPointerCapture ??= () => false;
proto.releasePointerCapture ??= () => {};
async function openMenu() {
  document.querySelector('[aria-haspopup="listbox"]')!.dispatchEvent(new PointerEvent('pointerdown', ptr));
  await settle();
}

describe('Select: группы и действия', () => {
  function mountHost(props: Record<string, unknown> = {}) {
    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(Host as any, { target, props });
    flushSync();
  }

  it('серии по group — под заголовком, строка рисуется через item', async () => {
    mountHost();
    await openMenu();
    const groups = Array.from(document.querySelectorAll('[role="listbox"] [role="group"]'));
    expect(groups.length).toBe(3);
    expect(groups[1].className).toContain('border-t');
    expect(groups[0].className).not.toContain('border-t');
    expect(document.body.textContent).toContain('Saved services');
    expect(byTestId('row-svc1')!.textContent).toBe('Late checkout');
  });

  it('клик по itemTrailing вызывает действие, не выбирает строку и не закрывает меню', async () => {
    const seen: string[] = [];
    mountHost({ onAction: (v: string) => seen.push(v) });
    await openMenu();
    press(byTestId('act-svc1')!);
    await settle();
    expect(seen).toEqual(['svc1']);
    expect(byTestId('val')!.textContent).toBe('');
    expect(options().length).toBe(3);
  });

  it('контроль: pointerup по обычной строке её выбирает', async () => {
    mountHost();
    await openMenu();
    press(options().find((o) => o.textContent?.includes('Breakfast'))!);
    await settle();
    expect(byTestId('val')!.textContent).toBe('breakfast');
  });

  it('bind:open — хост видит открытие и закрывает меню сам', async () => {
    mountHost();
    expect(byTestId('open')!.textContent).toBe('false');
    await openMenu();
    expect(byTestId('open')!.textContent).toBe('true');
    expect(options().length).toBe(3);
    unmount(comp);
    target.remove();
    document.body.innerHTML = '';
    mountHost({ open: true });
    await settle();
    expect(options().length).toBe(3);
  });

  it('multiple: чекбоксы в строках на месте', async () => {
    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(Select, { target, props: { options: OPTIONS, multiple: true, value: ['a'] } });
    flushSync();
    await openMenu();
    const rows = options();
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('svg path[d="M20 6L9 17l-5-5"]')).not.toBeNull();
    expect(rows[1].querySelector('svg')).toBeNull();
    expect(rows[0].textContent).toContain('Alpha');
  });
});
