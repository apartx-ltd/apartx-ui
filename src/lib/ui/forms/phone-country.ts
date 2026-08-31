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
 * `trunkRule` is applied only when the input carries no `+` at all — i.e. a raw
 * national number was typed or pasted. Anything already `+`-prefixed is taken
 * at face value: the user (or a paste) stated the country explicitly, and
 * second-guessing that is how you turn a valid `+81…` into garbage.
 */
export function sanitizePhone(raw: string, trunkRule?: TrunkRule): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  const hadPlus = cleaned.includes('+');
  let digits = cleaned.replace(/\+/g, '');
  if (!digits) return hadPlus ? '+' : '';
  if (!hadPlus && trunkRule?.prefix && digits.startsWith(trunkRule.prefix)) {
    digits = digitsOf(trunkRule.dialCode) + digits.slice(trunkRule.prefix.length);
  }
  return '+' + digits;
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
