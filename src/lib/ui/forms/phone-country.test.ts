import { describe, it, expect } from 'vitest';
import { sanitizePhone, splitPhone, countryChipLabel, type PhoneCountry } from './phone-country';

// Fixture mirrors the shape of `countryPhoneData` from the `phone` package,
// trimmed to the interesting cases: a shared code with disjoint ranges (+7),
// a shared code with many members (+1), a code owned by one country (+996),
// and a country whose ranges are unknown (+250) — it must never be excluded.
const COUNTRIES: PhoneCountry[] = [
  { country_name: 'Kazakhstan', country_code: '7', alpha2: 'KZ', mobile_begin_with: ['70', '74', '77'] },
  { country_name: 'Russian Federation', country_code: '7', alpha2: 'RU', mobile_begin_with: ['9', '495', '498'] },
  { country_name: 'United States', country_code: '1', alpha2: 'US', mobile_begin_with: ['201', '202', '415'] },
  { country_name: 'Bahamas', country_code: '1', alpha2: 'BS', mobile_begin_with: ['242'] },
  { country_name: 'Kyrgyzstan', country_code: '996', alpha2: 'KG', mobile_begin_with: ['5', '7'] },
  { country_name: 'Rwanda', country_code: '250', alpha2: 'RW' },
];

describe('sanitizePhone', () => {
  it('оставляет плюс и цифры, выкидывает всё остальное', () => {
    expect(sanitizePhone('+7 (701) 123-45-67')).toBe('+77011234567');
  });

  it('пустой ввод: плюс сохраняется, если он был', () => {
    expect(sanitizePhone('+')).toBe('+');
    expect(sanitizePhone('')).toBe('');
    expect(sanitizePhone('  ')).toBe('');
  });

  it('добавляет плюс к номеру без него', () => {
    expect(sanitizePhone('77011234567')).toBe('+77011234567');
  });

  it('trunkRule: национальная восьмёрка превращается в код страны', () => {
    expect(sanitizePhone('87011234567', { prefix: '8', dialCode: '+7' })).toBe('+77011234567');
  });

  it('trunkRule не трогает номер, который уже с плюсом', () => {
    // `+81…` — Япония, и «8» тут не национальный префикс. Переписать его в +7
    // значило бы испортить валидный номер.
    expect(sanitizePhone('+815012345678', { prefix: '8', dialCode: '+7' })).toBe('+815012345678');
  });
});

describe('splitPhone', () => {
  it('уникальный код: страна известна сразу, без национальной части', () => {
    const s = splitPhone('+996', COUNTRIES);
    expect(s.dialCode).toBe('+996');
    expect(s.country?.alpha2).toBe('KG');
    expect(s.nationalNumber).toBe('');
  });

  it('общий код без цифр: страна не выбрана, кандидатов двое', () => {
    const s = splitPhone('+7', COUNTRIES);
    expect(s.dialCode).toBe('+7');
    expect(s.country).toBeNull();
    expect(s.candidates.map((c) => c.alpha2)).toEqual(['KZ', 'RU']);
  });

  it('одна цифра национальной части уже различает KZ и RU', () => {
    expect(splitPhone('+77', COUNTRIES).country?.alpha2).toBe('KZ');
    expect(splitPhone('+79', COUNTRIES).country?.alpha2).toBe('RU');
  });

  it('полный номер: код, национальная часть и страна', () => {
    const s = splitPhone('+77011234567', COUNTRIES);
    expect(s.dialCode).toBe('+7');
    expect(s.nationalNumber).toBe('7011234567');
    expect(s.e164).toBe('+77011234567');
    expect(s.country?.alpha2).toBe('KZ');
  });

  it('NANP: area-код выбирает страну внутри +1', () => {
    expect(splitPhone('+14155552671', COUNTRIES).country?.alpha2).toBe('US');
    expect(splitPhone('+12425551234', COUNTRIES).country?.alpha2).toBe('BS');
  });

  it('цифры, не попавшие ни в один диапазон, оставляют неоднозначность', () => {
    // `+7 3…` — ни KZ (70/74/77), ни RU (9/495/498). Не угадываем.
    const s = splitPhone('+73123456789', COUNTRIES);
    expect(s.dialCode).toBe('+7');
    expect(s.country).toBeNull();
  });

  it('код длиннее выигрывает у более короткого', () => {
    // +996 не должен разобраться как +9 (такого кода нет) или как +99.
    expect(splitPhone('+996700112233', COUNTRIES).dialCode).toBe('+996');
  });

  it('нераспознанный код: ни страны, ни кандидатов', () => {
    const s = splitPhone('+42', COUNTRIES);
    expect(s.dialCode).toBe('');
    expect(s.country).toBeNull();
    expect(s.candidates).toEqual([]);
    expect(s.nationalNumber).toBe('42');
  });

  it('пустое значение не падает', () => {
    const s = splitPhone('+', COUNTRIES);
    expect(s).toMatchObject({ dialCode: '', nationalNumber: '', e164: '', country: null });
  });

  it('страну без данных о диапазонах исключить нельзя', () => {
    // Руанда одна на своём коде — резолвится по самому коду.
    expect(splitPhone('+250788123456', COUNTRIES).country?.alpha2).toBe('RW');
  });
});

describe('countryChipLabel', () => {
  it('страна известна — её название', () => {
    expect(countryChipLabel(splitPhone('+77011234567', COUNTRIES))).toBe('Kazakhstan');
  });

  it('страна ещё не выбрана — код', () => {
    expect(countryChipLabel(splitPhone('+7', COUNTRIES))).toBe('+7');
  });

  it('код не распознан — пусто', () => {
    expect(countryChipLabel(splitPhone('+42', COUNTRIES))).toBe('');
    expect(countryChipLabel(splitPhone('+', COUNTRIES))).toBe('');
  });
});
