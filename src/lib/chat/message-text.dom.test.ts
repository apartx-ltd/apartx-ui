// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import MessageText from './MessageText.svelte';

let app: any;
const render = (props: Record<string, any>) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  app = mount(MessageText, { target: host, props });
  flushSync();
  return host;
};
afterEach(() => { if (app) unmount(app); app = null; document.body.innerHTML = ''; });

describe('MessageText markdown mode', () => {
  it('renders strong/em/table/link, no dangerouslySet html', () => {
    const host = render({ mode: 'markdown', text: '**b** *i*\n\n| A |\n| --- |\n| 1 |\n\n[статья](#/article/a1)' });
    expect(host.querySelector('strong')?.textContent).toBe('b');
    expect(host.querySelector('em')?.textContent).toBe('i');
    expect(host.querySelector('table')).toBeTruthy();
    const a = host.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('#/article/a1');
    expect(a.textContent).toBe('статья');
  });

  it('raw HTML is rendered as literal text (no elements injected)', () => {
    const host = render({ mode: 'markdown', text: 'до <img src=x onerror=alert(1)> после' });
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('renders dialect tokens: spoiler blurred until clicked, footnotes listed', () => {
    const host = render({ mode: 'markdown', text: '||секрет||[^1]\n\n[^1]: сноска' });
    const spoiler = host.querySelector('[data-spoiler]')! as HTMLElement;
    expect(spoiler.getAttribute('data-revealed')).toBe('false');
    spoiler.click();
    flushSync();
    expect(spoiler.getAttribute('data-revealed')).toBe('true');
    expect(host.textContent).toContain('сноска');
  });
});

describe('MessageText plain mode', () => {
  it('auto-links bare URLs, keeps other text intact', () => {
    const host = render({ mode: 'plain', text: 'см https://example.com/x конец!' });
    const a = host.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.com/x');
    expect(host.textContent).toContain('конец!');
  });
});
