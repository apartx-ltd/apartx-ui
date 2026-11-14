// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Message from './Message.svelte';
import { registerChatDefaults } from './register-defaults';
import type { Message as Msg } from './types';

// Prop/slot hops Message -> MessageRenderer -> slotProps -> MessageTimeDefault: an alias-authored
// message renders on the own side (own bubble colour) only when meIds is passed.

let comp: any = null;
let target: HTMLElement;
const msg = { _id: 'm', chatId: 'c', userId: 'tenant:c1', seq: 3, text: 'hi', type: 'text', createdAt: new Date('2026-07-28T10:00:00Z') } as unknown as Msg;

function render(props: Record<string, any>) {
  registerChatDefaults();
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Message, { target, props: { message: msg, meUserId: 'u1', ...props } as any });
  flushSync();
  return target;
}
afterEach(() => { if (comp) unmount(comp); comp = null; target?.remove(); });

describe('meIds render', () => {
  it('alias-authored message is on the own side with meIds', () => {
    const el = render({ meIds: ['tenant:c1'] });
    expect(el.querySelector('.justify-end')).not.toBeNull();
    expect(el.querySelector('.bg-primary-container')).not.toBeNull();
  });
  it('without meIds it is on the other side', () => {
    const el = render({});
    expect(el.querySelector('.bg-primary-container')).toBeNull();
    expect(el.querySelector('.bg-surface-container')).not.toBeNull();
  });
});
