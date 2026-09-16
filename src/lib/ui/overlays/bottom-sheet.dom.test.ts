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

// jsdom не знает PointerEvent — событие нужного типа с полями мыши обработчикам достаточно
// (они смотрят только pointerType/screenY/screenX/pointerId).
const pointer = (type: string, init: { screenX: number; screenY: number }) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, screenX: init.screenX, screenY: init.screenY });
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
});
