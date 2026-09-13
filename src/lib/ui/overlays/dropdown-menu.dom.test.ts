// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/DropdownMenuHost.svelte';

// Геометрию (flip у нижнего края) jsdom не считает — её держит e2e кабинета
// rooms-locks.spec.ts «меню ключа у нижнего края…». Здесь — что меню это bits-слой
// Popover с потолком высоты по свободному месту, а API обёртки прежний.

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = async () => {
  flushSync();
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};

let mounted: any[] = [];
function mountHost() {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Host as any, { target });
  mounted.push(handle);
  flushSync();
  return handle;
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

describe('DropdownMenu', () => {
  it('class и прочие пропсы — на обёртке триггера', () => {
    mountHost();
    const wrapper = byTestId('dd-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain('host-wrapper');
    expect(wrapper!.contains(byTestId('dd-trigger'))).toBe(true);
  });

  it('меню — слой bits-ui Popover с потолком высоты по свободному месту', async () => {
    mountHost();
    byTestId('dd-trigger')!.click();
    await settle();

    const content = document.querySelector('[data-popover-content]') as HTMLElement | null;
    expect(content, 'контент bits Popover').not.toBeNull();
    expect(content!.getAttribute('role')).toBe('menu');
    expect(content!.className).toContain('max-h-[var(--bits-popover-content-available-height)]');
    expect(content!.className).toContain('min-w-48');
    expect(content!.contains(byTestId('dd-item'))).toBe(true);
    // Портал: меню вне обёртки триггера.
    expect(byTestId('dd-wrapper')!.contains(content)).toBe(false);
  });
});
