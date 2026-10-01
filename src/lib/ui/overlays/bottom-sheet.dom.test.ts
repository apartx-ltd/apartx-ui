// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/BottomSheetHost.svelte';

// Жест перетаскивания (снапы, скорость, передача скролла списку) считает геометрию, которой в
// jsdom нет — её держат e2e. Здесь одно: мышиный клик внутри шторки доходит до кнопки.
// До 0.10.2 шторка забирала pointer capture прямо на pointerdown, а браузер шлёт следующий
// `click` ЗАХВАТИВШЕМУ элементу — кнопки, табы и строки списка внутри шторки не нажимались
// мышью вовсе (тач шёл другим путём и не страдал, поэтому на телефоне было незаметно).

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

let mounted: any[] = [];
let captureSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = '';
  mounted = [];
  captureSpy = vi.fn();
  (Element.prototype as any).setPointerCapture = captureSpy;
  (Element.prototype as any).releasePointerCapture = vi.fn();
});
afterEach(() => {
  for (const handle of mounted) {
    try { unmount(handle); } catch { /* уже размонтирован */ }
  }
  document.body.innerHTML = '';
});

function mountHost(onpick: () => void) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Host as any, { target, props: { onpick } });
  mounted.push(handle);
  flushSync();
  return handle;
}

// Шторка въезжает за два кадра (сперва рисуется под экраном, потом отпускается к снапу) —
// ждём, пока она встанет на место, иначе «исходное положение» в тесте было бы положением въезда.
const settled = async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  flushSync();
};

// jsdom не знает PointerEvent — событие нужного типа с полями мыши обработчикам достаточно
// (они смотрят только pointerType/screenY/screenX/pointerId/buttons). buttons — маска нажатых
// кнопок: 1 при зажатой левой, 0 при движении без нажатия.
const pointer = (type: string, init: { screenX: number; screenY: number; buttons?: number }) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, screenX: init.screenX, screenY: init.screenY, buttons: init.buttons ?? 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
};

describe('BottomSheet', () => {
  it('нажатие мышью не забирает pointer capture — клик доходит до кнопки внутри', async () => {
    const onpick = vi.fn();
    mountHost(onpick);

    const button = byTestId('sheet-button');
    expect(button).toBeTruthy();

    button!.dispatchEvent(pointer('pointerdown', { screenY: 500, screenX: 100 }));
    flushSync();
    expect(captureSpy).not.toHaveBeenCalled();

    button!.dispatchEvent(pointer('pointerup', { screenY: 500, screenX: 100 }));
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(onpick).toHaveBeenCalledTimes(1);
  });

  // Захват берётся только после сдвига на 6px, и до него события вне шторки она не видит.
  // Нажали на шторке, отпустили мимо — pointerup до неё не дошёл. Раньше жест оставался
  // «нажатым»: следующее движение мыши над шторкой уже без кнопки тащило её за курсором.
  it('кнопку отпустили вне шторки — движение без нажатия шторку не тащит', async () => {
    mountHost(() => {});
    await settled();
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    const button = byTestId('sheet-button')!;
    const resting = sheet.style.transform;

    button.dispatchEvent(pointer('pointerdown', { screenY: 500, screenX: 100, buttons: 1 }));
    document.body.dispatchEvent(pointer('pointerup', { screenY: 300, screenX: 100 }));
    button.dispatchEvent(pointer('pointermove', { screenY: 300, screenX: 100, buttons: 0 }));
    flushSync();

    expect(captureSpy).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe(resting);
  });

  it('движение с зажатой кнопкой шторку тащит и забирает захват', async () => {
    mountHost(() => {});
    await settled();
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    const button = byTestId('sheet-button')!;
    const resting = sheet.style.transform;

    button.dispatchEvent(pointer('pointerdown', { screenY: 500, screenX: 100, buttons: 1 }));
    button.dispatchEvent(pointer('pointermove', { screenY: 400, screenX: 100, buttons: 1 }));
    flushSync();

    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(sheet.style.transform).not.toBe(resting);
  });
});
