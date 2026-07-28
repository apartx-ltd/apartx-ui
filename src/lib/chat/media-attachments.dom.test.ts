// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import MediaAttachments from './slots/MediaAttachments.svelte';
import type { Message } from './types';

// Real-DOM test of the media slot dispatcher. Pure layout arithmetic (сколько ячеек, есть ли hero,
// сколько ушло в «+N», какие строки-документы) живёт в `albumLayout` и покрыта юнит-тестом в
// helpers.test.ts — здесь проверяется только то, что без DOM не проверить: КАКОЙ компонент
// смонтировался, доехали ли до него пропсы, и что нажатие по ячейке зовёт openLightbox.

let comp: any = null;
let target: HTMLElement;

const msg = (over: Partial<Message> = {}): Message =>
  ({ _id: 'm', chatId: 'c', userId: 'u1', createdAt: new Date('2026-07-28T10:00:00Z'), ...over }) as Message;

const img = (n: number) => ({ fileId: `f${n}`, url: `https://cdn/${n}.jpg`, type: 'image/jpeg', name: `${n}.jpg` });

function render(props: Record<string, any>) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(MediaAttachments, { target, props });
  flushSync();
  return target;
}

const cells = () => Array.from(target.querySelectorAll('[data-testid="chat-album-cell"]'));
const taps = () => Array.from(target.querySelectorAll('[data-testid="chat-album-tap"]')) as HTMLElement[];

function tap(el: HTMLElement) {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  flushSync();
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('MediaAttachments — одиночное вложение (регрессия)', () => {
  it('делегирует ImageMedia и доносит оптимистичные пропсы отправки', () => {
    // Весь сегодняшний трафик — одно вложение; альбомный код не должен его перехватывать, иначе
    // потеряются sendState/uploadProgress/previewUrl, которых у альбома нет.
    const message = msg({
      type: 'image',
      sendState: 'sending',
      meta: {
        file: { url: 'blob:local', type: 'image/jpeg', width: 1200, height: 900 },
        previewUrl: 'blob:local',
        uploadProgress: 0.42,
      },
    } as any);
    const el = render({ message, openLightbox: () => {} });

    expect(el.querySelector('[data-testid="chat-album"]')).toBe(null); // не альбом
    // Подпись ImageMedia: коробка зарезервирована по реальным размерам (1200×900 → 300×225).
    expect((el.querySelector('div[style]') as HTMLElement).getAttribute('style')).toContain('height: 225px');
    expect(el.textContent).toContain('Uploading…');
    expect(el.textContent).toContain('42%'); // meta.uploadProgress доехал до слота
  });

  it('делегирует DocumentMedia — одиночный документ рисуется прежней строкой', () => {
    const message = msg({
      type: 'document',
      meta: { file: { url: 'https://cdn/a.pdf', type: 'application/pdf', name: 'act.pdf', size: 2048 } },
    } as any);
    const el = render({ message });

    expect(el.querySelector('[data-testid="chat-album"]')).toBe(null);
    const link = el.querySelector('a[download]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://cdn/a.pdf');
    expect(el.textContent).toContain('act.pdf');
    expect(el.textContent).toContain('2.0 KB');
  });
});

describe('MediaAttachments — альбом', () => {
  it('3 картинки: 3 ячейки, первая растянута на обе колонки', () => {
    const files = [img(1), img(2), img(3)];
    const el = render({ message: msg({ type: 'image', meta: { files, file: files[0] } } as any), openLightbox: () => {} });

    expect(el.querySelector('[data-testid="chat-album"]')).not.toBe(null);
    expect(cells()).toHaveLength(3);
    expect(cells()[0].className).toContain('col-span-2');
    expect(cells()[1].className).toContain('aspect-square');
    expect(el.querySelector('[data-testid="chat-album-more"]')).toBe(null);
  });

  it('6 картинок: рисуются только 4 ячейки, на последней оверлей «+2»', () => {
    const files = [1, 2, 3, 4, 5, 6].map(img);
    const el = render({ message: msg({ type: 'image', meta: { files, file: files[0] } } as any), openLightbox: () => {} });

    expect(cells()).toHaveLength(4);
    expect(cells()[0].className).not.toContain('col-span-2'); // чётное количество — hero нет
    const more = el.querySelector('[data-testid="chat-album-more"]') as HTMLElement;
    expect(more.textContent?.trim()).toBe('+2');
    expect(cells()[3].contains(more)).toBe(true); // оверлей именно на четвёртой ячейке
  });

  it('смешанный набор (2 картинки + pdf): сетка из 2 + одна строка документа', () => {
    const files = [img(1), img(2), { fileId: 'f3', url: 'https://cdn/a.pdf', type: 'application/pdf', name: 'act.pdf' }];
    // Тип сообщения задаёт ПЕРВОЕ вложение, поэтому смешанный альбом приезжает как 'image'.
    const el = render({ message: msg({ type: 'image', meta: { files, file: files[0] } } as any), openLightbox: () => {} });

    expect(cells()).toHaveLength(2);
    const docs = el.querySelectorAll('a[download]');
    expect(docs).toHaveLength(1);
    expect(docs[0].getAttribute('href')).toBe('https://cdn/a.pdf');
  });

  it('нажатие по ячейке зовёт openLightbox с url ИМЕННО этой картинки', () => {
    const files = [img(1), img(2), img(3)];
    const opened: string[] = [];
    render({ message: msg({ type: 'image', meta: { files, file: files[0] } } as any), openLightbox: (u: string) => opened.push(u) });

    tap(taps()[1]);
    expect(opened).toEqual(['https://cdn/2.jpg']);
    tap(taps()[2]);
    expect(opened).toEqual(['https://cdn/2.jpg', 'https://cdn/3.jpg']);
  });
});
