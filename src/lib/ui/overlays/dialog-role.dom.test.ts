// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/DialogRoleHost.svelte';

// Проп role у Dialog доходит до панели: bits-ui кладёт в props свой role (по variant), и без
// явной перезаписи на панели любой Dialog был бы role="dialog" — ConfirmDialog/AlertDialog тоже.

let handle: any = null;

afterEach(() => {
  if (handle) unmount(handle);
  handle = null;
  document.body.innerHTML = '';
});

function mountHost(props: { role?: 'dialog' | 'alertdialog' }) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  handle = mount(Host as any, { target, props });
  flushSync();
}

describe('Dialog role', () => {
  it('по умолчанию — dialog', () => {
    mountHost({});
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('role="alertdialog" — панель alertdialog, имя по заголовку', () => {
    mountHost({ role: 'alertdialog' });
    const panel = document.querySelector('[role="alertdialog"]') as HTMLElement | null;
    expect(panel).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const labelId = panel!.getAttribute('aria-labelledby');
    expect(labelId && document.getElementById(labelId)?.textContent).toContain('Role');
  });
});
