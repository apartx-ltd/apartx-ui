// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/PushPermissionDescriptionHost.svelte';
import { clearErrorHelpCache } from './error-toast';
import { toastLayer } from './toaster-context.svelte';

const tick = () => new Promise((r) => setTimeout(r, 0));
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

let mounted: any[] = [];
function mountHost(props: Record<string, unknown>) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const h = mount(Host as any, { target: el, props: props as any });
  mounted.push(h);
  flushSync();
  return h;
}

beforeEach(() => {
  clearErrorHelpCache();
  toastLayer.z = null;
  document.body.innerHTML = '';
  mounted = [];
});
afterEach(() => {
  for (const h of mounted) { try { unmount(h); } catch { /* уже размонтирован */ } }
  document.body.innerHTML = '';
});

describe('PushPermissionDescription', () => {
  it('статья по guideKey: кнопка «Инструкция», клик открывает её и ныряет тостер под модалки', async () => {
    let finish!: () => void;
    const onOpenArticle = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    const resolveErrorHelp = vi.fn().mockResolvedValue([{ slug: 'push-blocked-desktop', title: 'Desktop' }]);
    mountHost({ handlers: { resolveErrorHelp, onOpenArticle }, guideKey: 'push.blocked.desktop' });
    await tick();
    flushSync();

    expect(resolveErrorHelp).toHaveBeenCalledWith('push.blocked.desktop', 'en');
    const button = byTestId('push-permission-guide')!;
    expect(button.textContent).toContain('Instructions');
    button.click();
    await tick();
    expect(onOpenArticle).toHaveBeenCalledWith({ slug: 'push-blocked-desktop', title: 'Desktop' });
    expect(toastLayer.z).not.toBeNull();

    finish();
    await tick();
    expect(toastLayer.z).toBeNull();
  });

  it('тост убрали при открытой статье — хост тостов возвращается наверх', async () => {
    const onOpenArticle = vi.fn(() => new Promise<void>(() => { /* статья висит */ }));
    mountHost({
      handlers: { resolveErrorHelp: vi.fn().mockResolvedValue([{ slug: 's', title: 'T' }]), onOpenArticle },
      guideKey: 'push.blocked.ios',
    });
    await tick();
    flushSync();
    byTestId('push-permission-guide')!.click();
    await tick();
    expect(toastLayer.z).not.toBeNull();

    unmount(mounted.pop());
    expect(toastLayer.z).toBeNull();
  });

  it('без guideKey, без хендлеров или без статьи — только текст', async () => {
    const resolveErrorHelp = vi.fn().mockResolvedValue([]);
    mountHost({ handlers: { resolveErrorHelp, onOpenArticle: vi.fn() }, guideKey: null, text: 'Blocked' });
    expect(resolveErrorHelp).not.toHaveBeenCalled();
    expect(byTestId('push-permission-guide')).toBeNull();

    document.body.innerHTML = '';
    mountHost({ guideKey: 'push.blocked.desktop', text: 'Blocked' });
    await tick();
    flushSync();
    expect(document.body.textContent).toContain('Blocked');
    expect(byTestId('push-permission-guide')).toBeNull();

    document.body.innerHTML = '';
    mountHost({ handlers: { resolveErrorHelp, onOpenArticle: vi.fn() }, guideKey: 'push.blocked.desktop' });
    await tick();
    flushSync();
    expect(resolveErrorHelp).toHaveBeenCalledWith('push.blocked.desktop', 'en');
    expect(byTestId('push-permission-guide')).toBeNull();
  });
});
