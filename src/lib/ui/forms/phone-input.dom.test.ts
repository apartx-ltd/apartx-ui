// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './phone-input.harness.svelte';
import type { PhoneCountry, PhoneSplit } from './phone-country';

const COUNTRIES: PhoneCountry[] = [
  { country_name: 'Kazakhstan', country_code: '7', alpha2: 'KZ', mobile_begin_with: ['70', '74', '77'] },
  { country_name: 'Russian Federation', country_code: '7', alpha2: 'RU', mobile_begin_with: ['9', '495'] },
  { country_name: 'Kyrgyzstan', country_code: '996', alpha2: 'KG', mobile_begin_with: ['5', '7'] },
];

let comp: any = null;
let target: HTMLElement;

function setup(props: Record<string, unknown> = {}) {
  const parsed: PhoneSplit[] = [];
  let get: () => string = () => '';
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, {
    target,
    props: {
      onParsed: (p: PhoneSplit) => parsed.push(p),
      read: (g: () => string) => (get = g),
      ...props,
    },
  });
  flushSync();
  const input = target.querySelector('[data-testid="phone"]') as HTMLInputElement;
  return { input, parsed, value: () => get() };
}

/** Печать/вставку браузер отдаёт одним и тем же input-событием после правки value. */
function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

function chip(): HTMLElement | null {
  return target.querySelector('[data-testid="phone-country-chip"]');
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('PhoneInput — режим со списком стран', () => {
  it('пустое поле показывает плюс', () => {
    const { input } = setup({ countries: COUNTRIES });
    expect(input.value).toBe('+');
  });

  it('плюс не стереть: очистка поля возвращает его', () => {
    const { input, value } = setup({ countries: COUNTRIES });
    type(input, '+7701');
    type(input, '');
    expect(input.value).toBe('+');
    // Наружу при этом уходит пустое значение, а не «+»: форма должна видеть
    // незаполненный телефон, а не строку из одного символа.
    expect(value()).toBe('');
  });

  it('чип показывает код, пока стран несколько, и страну — как только цифры её выдали', () => {
    const { input } = setup({ countries: COUNTRIES });
    type(input, '+7');
    expect(chip()?.textContent?.trim()).toBe('+7');

    type(input, '+77');
    expect(chip()?.textContent?.trim()).toBe('Kazakhstan');

    type(input, '+79');
    expect(chip()?.textContent?.trim()).toBe('Russian Federation');
  });

  it('чип пуст, пока код не распознан', () => {
    const { input } = setup({ countries: COUNTRIES });
    type(input, '+42');
    expect(chip()).toBeNull();
  });

  it('наружу отдаётся `+цифры`, в поле — группировка за кодом', () => {
    const { input, value } = setup({ countries: COUNTRIES });
    type(input, '+7 701 123 4567');
    expect(value()).toBe('+77011234567');
    expect(input.value).toBe('+7 701 123 4567');
  });

  it('onParsed отдаёт код, национальную часть и страну', () => {
    const { input, parsed } = setup({ countries: COUNTRIES });
    type(input, '+77011234567');
    const last = parsed.at(-1)!;
    expect(last.dialCode).toBe('+7');
    expect(last.nationalNumber).toBe('7011234567');
    expect(last.e164).toBe('+77011234567');
    expect(last.country?.alpha2).toBe('KZ');
  });

  it('вставка национального номера с восьмёркой заменяет поле на +7…', () => {
    const { input, value } = setup({ countries: COUNTRIES, trunkRule: { prefix: '8', dialCode: '+7' } });
    const e = new Event('paste', { bubbles: true, cancelable: true }) as any;
    e.clipboardData = { getData: () => '8 701 123 45 67' };
    input.dispatchEvent(e);
    flushSync();
    expect(value()).toBe('+77011234567');
    expect(e.defaultPrevented).toBe(true);
    expect(chip()?.textContent?.trim()).toBe('Kazakhstan');
  });
});

describe('PhoneInput — легаси-режим без списка стран (контракт apartx-connect)', () => {
  it('плюс не навязывается, поле остаётся пустым', () => {
    const { input } = setup({ defaultCountryCode: '+7' });
    expect(input.value).toBe('');
    expect(chip()).toBeNull();
  });

  it('defaultCountryCode подставляется к вводу без плюса', () => {
    const { input, value } = setup({ defaultCountryCode: '+7' });
    type(input, '7011234567');
    expect(value()).toBe('+77011234567');
  });

  it('иконка телефона на месте, чипа нет', () => {
    setup({ defaultCountryCode: '+7' });
    expect(target.querySelector('svg')).not.toBeNull();
    expect(chip()).toBeNull();
  });

  it('restProps доезжают до инпута (data-testid)', () => {
    const { input } = setup({ defaultCountryCode: '+7' });
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('type')).toBe('tel');
  });
});
