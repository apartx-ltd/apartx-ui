/**
 * Country detection for `PhoneInput` — pure, data-driven, dependency-free.
 *
 * The kit never bundles a phone-number library: the consumer passes the country
 * table (e.g. `countryPhoneData` from the `phone` package) and everything here
 * works off that data alone.
 *
 * Countries sharing a dialing code (`+7` → Kazakhstan/Russia, `+1` → 25 NANP
 * members) are told apart by `mobile_begin_with` — the national-number prefixes
 * each country owns. That is why the full number is NOT required: `+7 7…` is
 * already unambiguously Kazakhstan, `+7 9…` is Russia.
 */

export interface PhoneCountry {
  country_name: string;
  country_code: string | number;
  alpha2?: string;
  alpha3?: string;
  /** National-number prefixes owned by this country (may be absent/empty). */
  mobile_begin_with?: string[];
  phone_number_lengths?: number[];
  [k: string]: unknown;
}

/**
 * National trunk prefix convention, as data. RU/KZ dial `8` where the rest of
 * the world dials the country code: `{prefix: '8', dialCode: '+7'}` turns a
 * pasted `8 701 …` into `+7 701 …`.
 */
export interface TrunkRule {
  prefix: string;
  dialCode: string;
}

export interface PhoneSplit {
  /** Detected dialing code with a leading `+`, or `''` when nothing matched. */
  dialCode: string;
  /** Digits after the dialing code. */
  nationalNumber: string;
  /** The whole thing, `+`-prefixed — same string the field holds. */
  e164: string;
  /** Uniquely resolved country, or `null` while still ambiguous/unknown. */
  country: PhoneCountry | null;
  /** Every country sharing the detected dialing code. */
  candidates: PhoneCountry[];
}

const digitsOf = (s: string): string => s.replace(/\D/g, '');

/**
 * Normalise arbitrary user input to `+<digits>`.
 *
 * Deliberately does NOT apply the trunk rule: while typing, every digit is a
 * prefix of the next one, and rewriting `8…` into `+7…` on the way would make
 * `86` (China) impossible to enter — it would turn into `+7 6…` on the second
 * keystroke. Trunk substitution belongs to paste, where the whole number
 * arrives at once — see `normalizePastedPhone`.
 */
export function sanitizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  const hadPlus = cleaned.includes('+');
  const digits = cleaned.replace(/\+/g, '');
  if (!digits) return hadPlus ? '+' : '';
  return '+' + digits;
}

/**
 * Normalise a pasted number, applying the national trunk convention
 * (`8 701 …` → `+7 701 …`).
 *
 * The rule fires only when all three hold: the paste carries no `+` (an
 * explicit country code is never second-guessed — that is how a valid `+81…`
 * would become garbage), it starts with the trunk prefix, and what remains
 * after swapping the prefix for the dialing code is a plausible national number
 * for that code — its length is one the target countries publish. That last
 * check is what keeps a pasted Chinese `86 138 0013 8000` from being read as a
 * Russian number: strip its `8` and 12 digits remain, while `+7` numbers are 10.
 */
export function normalizePastedPhone(raw: string, countries: PhoneCountry[] = [], trunkRule?: TrunkRule): string {
  const sanitized = sanitizePhone(raw);
  if (!trunkRule?.prefix || raw.includes('+')) return sanitized;

  const digits = sanitized.slice(1);
  if (!digits.startsWith(trunkRule.prefix)) return sanitized;

  const dialDigits = digitsOf(trunkRule.dialCode);
  const national = digits.slice(trunkRule.prefix.length);
  const targets = countries.filter((c) => String(c.country_code) === dialDigits);
  const lengths = targets.flatMap((c) => c.phone_number_lengths ?? []);
  // Без данных о длине (страны не переданы или таблица молчит) — доверяем правилу:
  // потребитель объявил конвенцию осознанно.
  if (lengths.length && !lengths.includes(national.length)) return sanitized;

  return '+' + dialDigits + national;
}

/**
 * A candidate survives if the digits typed so far are consistent with one of its
 * ranges — in either direction: `701…` starts with the range `70`, and the
 * half-typed `7` is a prefix of the range `70`. A country with no range data
 * can never be excluded (we do not know its ranges, so we do not pretend to).
 */
function matchesRanges(country: PhoneCountry, national: string): boolean {
  const ranges = country.mobile_begin_with;
  if (!ranges?.length) return true;
  return ranges.some((r) => national.startsWith(r) || r.startsWith(national));
}

/**
 * Split `+<digits>` into dialing code + national part and resolve the country
 * as far as the digits allow.
 */
export function splitPhone(value: string, countries: PhoneCountry[] = []): PhoneSplit {
  const digits = digitsOf(value);
  const e164 = digits ? '+' + digits : '';

  // Longest dialing code wins: `+1` must not shadow `+1242`-style tables, and
  // `+7` must not shadow a hypothetical `+79`.
  let codeLength = 0;
  for (const c of countries) {
    const code = String(c.country_code ?? '');
    if (!code || code.length <= codeLength) continue;
    if (digits.startsWith(code)) codeLength = code.length;
  }
  if (!codeLength) {
    return { dialCode: '', nationalNumber: digits, e164, country: null, candidates: [] };
  }

  const code = digits.slice(0, codeLength);
  const nationalNumber = digits.slice(codeLength);
  const candidates = countries.filter((c) => String(c.country_code) === code);

  let country: PhoneCountry | null = candidates.length === 1 ? candidates[0]! : null;
  if (!country && nationalNumber) {
    const narrowed = candidates.filter((c) => matchesRanges(c, nationalNumber));
    // Exactly one survivor ⇒ resolved. Zero survivors means the number matches
    // nobody's published range (landlines are covered only partially), so we
    // stay ambiguous rather than guessing.
    if (narrowed.length === 1) country = narrowed[0]!;
  }

  return { dialCode: '+' + code, nationalNumber, e164, country, candidates };
}

/**
 * What the indicator chip shows: the country once resolved, the dialing code
 * while several countries still share it, nothing at all before a code matched.
 */
export function countryChipLabel(split: PhoneSplit): string {
  if (split.country) return split.country.country_name;
  return split.dialCode;
}
