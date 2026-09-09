// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

// Both map components are swapped for the stub BEFORE MapPreview is imported: MapPreview
// pulls them in with a dynamic import(), and vi.mock intercepts that just like a static one.
vi.mock('./MapView.svelte', () => import('./MapPreview.stub.svelte'));
vi.mock('./MapMarker.svelte', () => import('./MapPreview.stub.svelte'));

import MapPreview from './MapPreview.svelte';

const ALMATY = { lng: 76.889709, lat: 43.238949 };
const SIZE = { width: 300, height: 150 };

let comp: any = null;
let target: HTMLElement;

// jsdom has no matchMedia; useMobile() reads it in an effect. `mobile` controls the answer.
let mobile = false;
beforeEach(() => {
  (window as any).matchMedia = (query: string) => ({
    matches: mobile,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target.remove();
  document.body.innerHTML = '';
});

function setup(props: Record<string, any> = {}) {
  comp = mount(MapPreview, {
    target,
    props: {
      provider: 'yandex',
      apiKey: 'js-key',
      staticApiKey: 'static-key',
      center: ALMATY,
      zoom: 16,
      size: SIZE,
      markers: [{ coordinates: ALMATY }],
      openLabel: 'Show on map',
      ...props,
    },
  });
  flushSync();
  return comp;
}

/** The dialog panel: the element carrying the kit's enter-animation class. */
function panel(): HTMLElement | null {
  return document.querySelector('.dlg-in-sheet, .dlg-in-pop');
}

/**
 * Wait for the dynamic import() inside the dialog to land. `tick()` is not enough: resolving a
 * module goes through vite-node, which takes macrotasks, not just microtask turns.
 */
async function settle() {
  for (let i = 0; i < 40; i++) {
    flushSync();
    if (document.querySelector('[data-testid="map-stub"]')) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  flushSync();
}

describe('MapPreview', () => {
  it('до клика: кнопка с aria-label и <img> статики, диалога и карты нет', () => {
    setup();
    const button = target.querySelector('button[aria-label="Show on map"]');
    expect(button).not.toBeNull();
    const img = button!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('static-maps.yandex.ru');
    expect(img!.getAttribute('src')).toContain('apikey=static-key');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[data-testid="map-stub"]')).toBeNull();
  });

  it('клик открывает диалог и монтирует карту с теми же center/zoom', async () => {
    setup();
    (target.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const stub = document.querySelector('[data-testid="map-stub"]') as HTMLElement;
    expect(stub).not.toBeNull();
    expect(stub.dataset.lat).toBe(String(ALMATY.lat));
    expect(stub.dataset.lng).toBe(String(ALMATY.lng));
    expect(stub.dataset.zoom).toBe('16');
  });

  it('fullScreen={true} — лист, {false} — окно', async () => {
    setup({ fullScreen: true });
    (target.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(panel()?.classList.contains('dlg-in-sheet')).toBe(true);
    unmount(comp); comp = null; document.body.innerHTML = '';
    target = document.createElement('div'); document.body.appendChild(target);

    setup({ fullScreen: false });
    (target.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(panel()?.classList.contains('dlg-in-pop')).toBe(true);
  });

  it('fullScreen не задан — по matchMedia (useMobile)', async () => {
    mobile = true;
    setup();
    (target.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(panel()?.classList.contains('dlg-in-sheet')).toBe(true);
    mobile = false;
  });

  it('center: null → ничего не рендерит', () => {
    setup({ center: null });
    expect(target.querySelector('button')).toBeNull();
  });

  it('без ключа статики кнопка остаётся — с плейсхолдером вместо <img>', () => {
    setup({ staticApiKey: '', apiKey: '' });
    const button = target.querySelector('button[aria-label="Show on map"]');
    expect(button).not.toBeNull();
    expect(button!.querySelector('img')).toBeNull();
    expect(button!.textContent).toContain('Show on map');
  });
});
