// Хост, закрывающий панель с hash-маршрутом, сам прогоняет гард ухода: раннер — часть публичного баррели.
import { describe, it, expect } from 'vitest';
import * as router from '../index';

describe('apartx-ui/router barrel', () => {
  it('exports the leave-guard runner', async () => {
    expect(typeof router.requestLeave).toBe('function');
    expect(typeof router.isLeaveBlocked).toBe('function');
    expect(router.isLeaveBlocked()).toBe(false);
    let proceeded = false;
    await router.requestLeave(() => { proceeded = true; });
    expect(proceeded).toBe(true);
  });
});
