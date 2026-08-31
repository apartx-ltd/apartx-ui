<script lang="ts">
  import TextField from './TextField.svelte';
  import Icon from '../display/Icon.svelte';
  import { faPhone } from '@fortawesome/free-solid-svg-icons';
  import { cn } from '../utils/cn';
  import { sanitizePhone, splitPhone, countryChipLabel, type PhoneCountry, type TrunkRule, type PhoneSplit } from './phone-country';

  /**
   * Phone number field built on TextField. Sanitises input to a leading `+`
   * and digits, and applies light, locale-agnostic grouping for readability.
   * Intentionally dependency-free (no libphonenumber): `value` is the cleaned
   * `+<digits>` string, suitable for storage and later normalisation.
   *
   * Pass `countries` (e.g. `countryPhoneData` from the `phone` package) to get
   * the full field: the number is entered in one go starting with the country
   * code (an un-erasable `+` states that up front), and a chip under the field
   * names the country as soon as the digits identify it — `+7 7…` Kazakhstan,
   * `+7 9…` Russia. There is no country picker and no default country: a number
   * without its code cannot be attributed to a country, so the field asks for
   * the code instead of guessing one.
   *
   * Without `countries` the component behaves exactly as before (icon on the
   * left, `defaultCountryCode` for code-less input) — consumers pinned to that
   * shape keep working untouched.
   */
  let {
    value = $bindable(''),
    label = '',
    placeholder = '+1 555 123 4567',
    error = '',
    required = false,
    disabled = false,
    defaultCountryCode = '',
    countries = [],
    trunkRule,
    onValueChange,
    onParsed,
    class: className,
    ...restProps
  }: {
    value?: string;
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    /** Legacy mode only: dialing code prepended if the user types without a leading `+`, e.g. "+7". */
    defaultCountryCode?: string;
    /** Country table (e.g. `countryPhoneData` from `phone`). Presence enables the country chip. */
    countries?: PhoneCountry[];
    /** National trunk-prefix convention, e.g. `{prefix: '8', dialCode: '+7'}` for RU/KZ. */
    trunkRule?: TrunkRule;
    onValueChange?: (v: string) => void;
    /** Fires with the parsed number whenever it changes — for forms storing code and number apart. */
    onParsed?: (parsed: PhoneSplit) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  const withCountries = $derived(countries.length > 0);

  // Keep only a single leading "+" and digits.
  function sanitize(raw: string): string {
    if (withCountries) return sanitizePhone(raw, trunkRule);
    let cleaned = raw.replace(/[^\d+]/g, '');
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\+/g, '');
    if (!hasPlus && defaultCountryCode && cleaned) {
      return defaultCountryCode.replace(/[^\d+]/g, '').replace(/^\+?/, '+') + cleaned;
    }
    return (hasPlus ? '+' : '') + cleaned;
  }

  const split = $derived(withCountries ? splitPhone(value, countries) : null);
  const chipLabel = $derived(split ? countryChipLabel(split) : '');

  // The chip lives UNDER the field, not inside it: country names are long
  // ("Russian Federation"), and a name inside the input either eats the digits'
  // room or forces the row wider than a phone screen.
  let display = $derived(withCountries ? formatWithCode(split!) : formatDisplay(value));

  /**
   * Group the national part in 3s behind the detected code: `+7 701 123 4567`.
   * A lone trailing digit joins the previous group instead of standing on its
   * own — plain 3s render a 10-digit number as `701 123 456 7`, and that stray
   * digit reads as a typo.
   */
  function formatWithCode(s: PhoneSplit): string {
    if (!s.e164) return '+';
    if (!s.dialCode) return s.e164;
    const groups = s.nationalNumber.match(/\d{1,3}/g) ?? [];
    if (groups.length > 1 && groups[groups.length - 1]!.length === 1) {
      groups[groups.length - 2] += groups.pop();
    }
    const grouped = groups.join(' ');
    return grouped ? `${s.dialCode} ${grouped}` : s.dialCode;
  }

  // Group digits in 3s after the country code for display only.
  function formatDisplay(v: string): string {
    if (!v) return '';
    const plus = v.startsWith('+');
    const digits = v.replace(/\D/g, '');
    if (!digits) return plus ? '+' : '';
    const cc = plus ? digits.slice(0, Math.min(2, digits.length)) : '';
    const rest = plus ? digits.slice(cc.length) : digits;
    const grouped = rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    return `${plus ? '+' + cc : ''}${grouped ? ' ' + grouped : ''}`.trim();
  }

  function commit(next: string) {
    value = next;
    onValueChange?.(next);
    if (withCountries) onParsed?.(splitPhone(next, countries));
  }

  function handleInput(e: Event) {
    commit(sanitize((e.target as HTMLInputElement).value));
  }

  /**
   * A pasted number is a complete statement of the country, so it goes through
   * the trunk rule on its own (`8 701 …` → `+7 701 …`) and replaces the field
   * wholesale — otherwise it would land after the field's own `+` and read as a
   * different country entirely.
   */
  function handlePaste(e: ClipboardEvent) {
    if (!withCountries) return;
    const pasted = (e.clipboardData ?? (window as any).clipboardData)?.getData('text');
    if (!pasted) return;
    const next = sanitizePhone(pasted, trunkRule);
    if (!next || next === '+') return;
    e.preventDefault();
    commit(next);
  }
</script>

<!-- Two explicit trees, not one parameterised: the legacy branch must stay the
     component it has always been (bare TextField + icon, no wrapper element),
     and a `{#snippet}` only becomes a component prop as a DIRECT child — behind
     an `{#if}` it silently isn't one. -->
{#if withCountries}
  <div class={cn('flex flex-col gap-1', className)}>
    <TextField
      value={display}
      {label}
      {placeholder}
      {error}
      {required}
      {disabled}
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      oninput={handleInput}
      onpaste={handlePaste}
      {...restProps}
    />

    {#if chipLabel}
      <span
        class="self-start max-w-full truncate rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant"
        data-testid="phone-country-chip"
      >
        {chipLabel}
      </span>
    {/if}
  </div>
{:else}
  <TextField
    value={display}
    {label}
    {placeholder}
    {error}
    {required}
    {disabled}
    type="tel"
    inputmode="tel"
    autocomplete="tel"
    class={className}
    oninput={handleInput}
    {...restProps}
  >
    {#snippet start()}
      <Icon icon={faPhone} />
    {/snippet}
  </TextField>
{/if}
