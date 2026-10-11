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
// jsdom: bits открывает триггер по pointerdown, синтетический click меню не открывает —
// открываем тем же путём, что клавиатура (ArrowDown на input).
async function open() {
  document.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
}
// bits выбирает строку по pointerup — настоящий жест, а не одиночный click.
function press(el: HTMLElement) {
  const init = { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' };
  el.dispatchEvent(new PointerEvent('pointerdown', init));
  el.dispatchEvent(new PointerEvent('pointerup', init));
  el.dispatchEvent(new MouseEvent('click', init));
}
async function type(text: string) {
  const input = document.querySelector('input') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  return input;
}
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

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

  it('попап по ширине поля (как у Select), шеврон — тот же svg, что у Select', async () => {
    mountHost();
    await open();
    const content = document.querySelector('[data-combobox-content]') as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.getAttribute('style')).toMatch(/(^|;)\s*width:\s*var\(--bits-combobox-anchor-width\)/);
    expect(document.querySelector('[aria-label="Open"] svg path[d="M6 9l6 6 6-6"]')).not.toBeNull();
  });

  it('клик по itemTrailing вызывает действие и НЕ выбирает строку', async () => {
    const seen: string[] = [];
    mountHost({ onAction: (v: string) => seen.push(v) });
    await open();
    press(byTestId('act-acme')!);
    await settle();
    expect(seen).toEqual(['acme']);
    expect(byTestId('val')!.textContent).toBe('');
  });

  // Страхует от отката обёртки к «только stopPropagation»: сам bits-Item тоже вызывает
  // preventDefault на pointerdown, поэтому тест не отличит наш keepFocus от нуля — он ловит
  // лишь регресс, при котором pointerdown перестаёт быть defaultPrevented вовсе.
  it('pointerdown по itemTrailing не уводит фокус из input (preventDefault)', async () => {
    mountHost();
    await open();
    const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    byTestId('act-acme')!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('контроль: pointerup по обычной строке её выбирает', async () => {
    mountHost();
    await open();
    press(options()[0]);
    await settle();
    expect(byTestId('val')!.textContent).toBe('cash');
  });

  it('freeSolo: Enter по строке «создать» сохраняет value и закрывает меню', async () => {
    mountHost({ freeSolo: true });
    await open();
    const input = await type('Petty cash');
    key(input, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe('Petty cash');
    expect(options().length).toBe(0);
  });

  it('freeSolo: pointerup по строке «создать» сохраняет value и закрывает меню', async () => {
    mountHost({ freeSolo: true });
    await open();
    await type('Petty cash');
    press(options().find((o) => o.textContent?.trim() === 'Petty cash')!);
    await settle();
    expect(byTestId('val')!.textContent).toBe('Petty cash');
    expect(options().length).toBe(0);
  });

  it('freeSolo: текст, совпавший с label опции, коммитит её value', async () => {
    mountHost({ freeSolo: true, options: [{ value: 'acc_1', label: 'Bank' }] });
    await open();
    const input = await type('bank');
    key(input, 'Escape');
    await settle();
    expect(byTestId('val')!.textContent).toBe('acc_1');
  });

  it('freeSolo: Enter без ввода при значении вне списка закрывает меню и не подменяет значение', async () => {
    mountHost({ freeSolo: true, value: 'Petty cash' });
    await open();
    expect(options().length).toBeGreaterThan(0);
    key(document.querySelector('input')!, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe('Petty cash');
    expect(options().length).toBe(0);
  });

  it('freeSolo: стрелками до опции и Enter — опция выбирается', async () => {
    mountHost({ freeSolo: true, value: 'Petty cash' });
    await open();
    const input = document.querySelector('input')!;
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    await settle();
    key(input, 'Enter');
    await settle();
    expect(['cash', 'card', 'acme']).toContain(byTestId('val')!.textContent);
  });

  it('freeSolo: Enter после посимвольного ввода подтверждает набранный текст, а не опцию', async () => {
    mountHost({ freeSolo: true });
    await open();
    await type('C');
    const input = await type('Ca');
    key(input, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe('Ca');
    expect(options().length).toBe(0);
  });

  it('freeSolo: Enter после ввода целиком подтверждает набранный текст', async () => {
    mountHost({ freeSolo: true });
    await open();
    const input = await type('Car');
    key(input, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe('Car');
    expect(options().length).toBe(0);
  });

  it('freeSolo: ввод, стрелка и Enter — выбирается подсвеченная опция', async () => {
    mountHost({ freeSolo: true });
    await open();
    await type('C');
    const input = await type('Ca');
    key(input, 'ArrowDown');
    await settle();
    const highlighted = options().find((o) => o.hasAttribute('data-highlighted'))!;
    const expected = highlighted.textContent!.trim();
    key(input, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe(expected.toLowerCase());
    expect(options().length).toBe(0);
  });

  it('freeSolo: пустое значение, ArrowDown открывает, Enter выбирает первую опцию', async () => {
    mountHost({ freeSolo: true });
    await open();
    key(document.querySelector('input')!, 'Enter');
    await settle();
    expect(byTestId('val')!.textContent).toBe('cash');
  });

  it('freeSolo: программное open=true засевает input текущим значением', async () => {
    mountHost({ freeSolo: true });
    byTestId('host-set-value')!.click();
    await settle();
    byTestId('host-open')!.click();
    await settle();
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Bank 2');
    expect(options().length).toBe(3);
  });

  it('freeSolo: открытие не стирает сохранённый текст, фильтр включается после ввода', async () => {
    mountHost({ freeSolo: true, value: 'Petty cash' });
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Petty cash');
    await open();
    expect(input.value).toBe('Petty cash');
    expect(options().filter((o) => ['Cash', 'Card', 'ACME x'].includes(o.textContent?.replace(/\s+/g, ' ').trim() ?? '')).length).toBe(3);
    await type('Petty cash 2');
    expect(byTestId('val')!.textContent).toBe('Petty cash 2');
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
