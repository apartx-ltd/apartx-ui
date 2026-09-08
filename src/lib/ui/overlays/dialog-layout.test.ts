import { describe, it, expect } from 'vitest';
import { dialogBodyClass } from './dialog-layout';

describe('dialogBodyClass', () => {
  it('form: отступы есть и растут с sm — поля не липнут к краям', () => {
    expect(dialogBodyClass('form')).toBe('px-4 py-3 sm:px-6 sm:py-4');
  });

  it('list: боковых отступов нет — их несёт Item, список идёт во всю ширину', () => {
    expect(dialogBodyClass('list')).toBe('px-0 py-2');
  });

  // Пустая строка принципиальна: 'p-0' попал бы в tailwind-merge и не погасил бы
  // sm:px-6 sm:py-4 — конфликты разрешаются только внутри одного набора модификаторов.
  it('flush: отступов нет вовсе — пустая строка, а не p-0', () => {
    expect(dialogBodyClass('flush')).toBe('');
  });

  it('без аргумента ведёт себя как form — старые вызовы Dialog не меняют вид', () => {
    expect(dialogBodyClass()).toBe(dialogBodyClass('form'));
  });
});
