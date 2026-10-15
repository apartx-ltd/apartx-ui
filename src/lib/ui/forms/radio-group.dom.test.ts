// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import RadioGroup from './RadioGroup.svelte';
import { utilityApplies } from '../__fixtures__/tailwind-match';

let comp: any = null;
let host: HTMLElement;

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  host?.remove();
});

// Точка радио — Tailwind-вариант состояния, jsdom его не вычисляет: utilityApplies компилирует
// классы точки и матчит селекторы на элементе. Регресс: `[[data-state=checked]_&]` ловил любого
// отмеченного предка (группа внутри отмеченного пункта меню/тогла), и точка горела у всех опций.
describe('RadioGroup', () => {
  it('внутри отмеченного предка точка горит только у выбранной опции', async () => {
    host = document.createElement('div');
    host.setAttribute('data-state', 'checked');
    document.body.appendChild(host);
    comp = mount(RadioGroup, {
      target: host,
      props: { value: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    });
    flushSync();

    const [a, b] = [...host.querySelectorAll('button')] as HTMLButtonElement[];
    expect(a.getAttribute('data-state')).toBe('checked');
    expect(b.getAttribute('data-state')).toBe('unchecked');

    expect(await utilityApplies(a.querySelector('span')!, 'scale-100')).toBe(true);
    expect(await utilityApplies(b.querySelector('span')!, 'scale-100')).toBe(false);
  });
});
