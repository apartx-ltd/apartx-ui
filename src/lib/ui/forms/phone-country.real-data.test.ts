import { describe, it, expect } from 'vitest';
import { countryPhoneData } from 'phone';
import { splitPhone, countryChipLabel, normalizePastedPhone, type PhoneCountry } from './phone-country';

/**
 * Детект против НАСТОЯЩЕЙ таблицы стран (`countryPhoneData` из пакета `phone`) —
 * той самой, что передают кабинет и демо-страница. Синтетическая фикстура в
 * соседнем тесте проверяет алгоритм, этот файл — что алгоритм совпадает с
 * реальными данными: список живой, коды и диапазоны в нём меняются.
 *
 * `phone` здесь dev-зависимость: сам кит остаётся без зависимостей, страны
 * всегда приходят от потребителя.
 */
const COUNTRIES = countryPhoneData as unknown as PhoneCountry[];

const nameOf = (v: string) => splitPhone(v, COUNTRIES).country?.country_name ?? null;

describe('splitPhone на реальной таблице стран', () => {
  it('уникальный код определяет страну сразу, без национальной части', () => {
    // Регрессия из демо: «+81» не показывал Японию — в урезанной демо-выборке
    // её просто не было. На реальной таблице код уникален и решает сам.
    expect(nameOf('+81')).toBe('Japan');
    expect(nameOf('+49')).toBe('Germany');
    expect(nameOf('+380')).toBe('Ukraine');
  });

  it('общий код +7 различается первой цифрой национальной части', () => {
    expect(nameOf('+7')).toBeNull();
    expect(nameOf('+77')).toBe('Kazakhstan');
    expect(nameOf('+79')).toBe('Russian Federation');
    expect(nameOf('+77011234567')).toBe('Kazakhstan');
    expect(nameOf('+79161234567')).toBe('Russian Federation');
  });

  it('чип показывает код, пока страна не определилась', () => {
    expect(countryChipLabel(splitPhone('+7', COUNTRIES))).toBe('+7');
    expect(countryChipLabel(splitPhone('+77011234567', COUNTRIES))).toBe('Kazakhstan');
  });

  it('длинный код не путается с коротким', () => {
    expect(splitPhone('+996700112233', COUNTRIES).dialCode).toBe('+996');
    expect(nameOf('+996700112233')).toBe('Kyrgyzstan');
  });

  it('национальная часть отрезается по длине кода', () => {
    const s = splitPhone('+81 50 1234 5678', COUNTRIES);
    expect(s.dialCode).toBe('+81');
    expect(s.nationalNumber).toBe('5012345678');
  });

  it('несуществующий код не выдаёт ни страны, ни кандидатов', () => {
    const s = splitPhone('+999', COUNTRIES);
    expect(s.dialCode).toBe('');
    expect(s.candidates).toEqual([]);
  });

  it('код Китая набирается: +86 — это Китай, а не «восьмёрка» российской конвенции', () => {
    expect(nameOf('+8613800138000')).toBe('China');
  });
});

describe('normalizePastedPhone на реальной таблице стран', () => {
  const TRUNK = { prefix: '8', dialCode: '+7' };

  it('вставка национального номера РФ/КЗ переводится в международный', () => {
    expect(normalizePastedPhone('8 701 123 45 67', COUNTRIES, TRUNK)).toBe('+77011234567');
    expect(nameOf(normalizePastedPhone('89161234567', COUNTRIES, TRUNK))).toBe('Russian Federation');
  });

  it('вставленный китайский номер без плюса остаётся китайским', () => {
    expect(nameOf(normalizePastedPhone('8613800138000', COUNTRIES, TRUNK))).toBe('China');
  });
});
