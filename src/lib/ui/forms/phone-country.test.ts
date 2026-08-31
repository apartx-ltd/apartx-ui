import { describe, it, expect } from 'vitest';
import { sanitizePhone, normalizePastedPhone, splitPhone, countryChipLabel, type PhoneCountry } from './phone-country';

// Fixture mirrors the shape of `countryPhoneData` from the `phone` package,
// trimmed to the interesting cases: a shared code with disjoint ranges (+7),
// a shared code with many members (+1), a code owned by one country (+996),
// and a country whose ranges are unknown (+250) — it must never be excluded.
const COUNTRIES: PhoneCountry[] = [
  { country_name: 'Kazakhstan', country_code: '7', alpha2: 'KZ', mobile_begin_with: ['70', '74', '77'], phone_number_lengths: [10] },
  { country_name: 'Russian Federation', country_code: '7', alpha2: 'RU', mobile_begin_with: ['9', '495', '498'], phone_number_lengths: [10] },
  { country_name: 'United States', country_code: '1', alpha2: 'US', mobile_begin_with: ['201', '202', '415'], phone_number_lengths: [10] },
  { country_name: 'Bahamas', country_code: '1', alpha2: 'BS', mobile_begin_with: ['242'], phone_number_lengths: [10] },
  { country_name: 'Kyrgyzstan', country_code: '996', alpha2: 'KG', mobile_begin_with: ['5', '7'], phone_number_lengths: [9] },
  { country_name: 'China', country_code: '86', alpha2: 'CN', mobile_begin_with: ['13', '15', '18'], phone_number_lengths: [11] },
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

  it('при наборе восьмёрка НЕ превращается в код страны', () => {
    // Регрессия: пользователь стирает `+`, набирает «86» (Китай) — правило
    // `8 → +7` на вводе делало из этого «+7 6…», и код Китая было не набрать.
    // На наборе конвертации нет вообще: каждая цифра — префикс следующей.
    expect(sanitizePhone('86')).toBe('+86');
    expect(sanitizePhone('8')).toBe('+8');
    expect(sanitizePhone('8613800138000')).toBe('+8613800138000');
  });
});

describe('normalizePastedPhone', () => {
  const TRUNK = { prefix: '8', dialCode: '+7' };

  it('вставленный национальный номер с восьмёркой становится международным', () => {
    expect(normalizePastedPhone('8 701 123 45 67', COUNTRIES, TRUNK)).toBe('+77011234567');
    expect(normalizePastedPhone('89161234567', COUNTRIES, TRUNK)).toBe('+79161234567');
  });

  it('китайский номер, вставленный без плюса, не читается как российский', () => {
    // Снять «8» и остаётся 12 цифр, а у +7 национальная часть — 10.
    // Длина не сошлась ⇒ правило не срабатывает.
    expect(normalizePastedPhone('8613800138000', COUNTRIES, TRUNK)).toBe('+8613800138000');
  });

  it('номер с плюсом остаётся как есть', () => {
    expect(normalizePastedPhone('+8613800138000', COUNTRIES, TRUNK)).toBe('+8613800138000');
  });

  it('без trunkRule вставка просто нормализуется', () => {
    expect(normalizePastedPhone('8 701 123 45 67', COUNTRIES)).toBe('+87011234567');
  });

  it('без данных о длине правилу доверяем', () => {
    expect(normalizePastedPhone('87011234567', [], TRUNK)).toBe('+77011234567');
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
