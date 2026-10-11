// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/ComboboxHost.svelte';

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = async () => {
  flushSync();
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};
const options = () => Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];

let mounted: any[] = [];
function mountHost(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Host as any, { target, props });
  mounted.push(handle);
  flushSync();
  return handle;
}
async function open() {
  (document.querySelector('button[aria-label="Open"]') as HTMLElement).click();
  await settle();
  // jsdom: bits открывает триггер по pointerdown, синтетический click меню не открывает —
  // открываем тем же путём, что клавиатура (ArrowDown на input).
  if (options().length === 0) {
    document.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  mounted = [];
});
afterEach(() => {
  for (const handle of mounted) {
    try { unmount(handle); } catch { /* уже размонтирован */ }
  }
  document.body.innerHTML = '';
});

describe('Combobox', () => {
  it('серия с group — под заголовком, остальные без', async () => {
    mountHost();
    await open();
    // внутри строки два span — схлопнуть переносы между ними
    expect(options().map((o) => o.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Cash', 'Card', 'ACME x']);
    const headings = Array.from(document.querySelectorAll('[role="listbox"] [role="group"]'));
    expect(headings.length).toBe(2);
    expect(document.body.textContent).toContain('Custom');
  });

  it('клик по itemTrailing вызывает действие и НЕ выбирает строку', async () => {
    const seen: string[] = [];
    mountHost({ onAction: (v: string) => seen.push(v) });
    await open();
    byTestId('act-acme')!.click();
    await settle();
    expect(seen).toEqual(['acme']);
    expect(byTestId('val')!.textContent).toBe('');
  });

  it('freeSolo: набранный текст сразу становится value и показан после закрытия', async () => {
    mountHost({ freeSolo: true });
    await open();
    const input = document.querySelector('input') as HTMLInputElement;
    input.value = 'Petty cash';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(byTestId('val')!.textContent).toBe('Petty cash');
    // строка «создать» несёт сам текст, без префикса Create
    expect(options().some((o) => o.textContent?.trim() === 'Petty cash')).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(input.value).toBe('Petty cash');
  });

  it('без freeSolo набранный текст value не трогает', async () => {
    mountHost();
    await open();
    const input = document.querySelector('input') as HTMLInputElement;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(byTestId('val')!.textContent).toBe('');
  });
});
