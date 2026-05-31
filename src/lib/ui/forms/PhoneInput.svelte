<script lang="ts">
  import TextField from './TextField.svelte';
  import Icon from '../display/Icon.svelte';
  import { faPhone } from '@fortawesome/free-solid-svg-icons';

  /**
   * Phone number field built on TextField. Sanitises input to a leading `+`
   * and digits, and applies light, locale-agnostic grouping for readability.
   * Intentionally dependency-free (no libphonenumber): `value` is the cleaned
   * `+<digits>` string, suitable for storage and later normalisation.
   */
  let {
    value = $bindable(''),
    label = '',
    placeholder = '+1 555 123 4567',
    error = '',
    required = false,
    disabled = false,
    defaultCountryCode = '',
    onValueChange,
    class: className,
    ...restProps
  }: {
    value?: string;
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    /** Dialing code prepended if the user starts typing without a leading `+`, e.g. "+7". */
    defaultCountryCode?: string;
    onValueChange?: (v: string) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  // Keep only a single leading "+" and digits.
  function sanitize(raw: string): string {
    let cleaned = raw.replace(/[^\d+]/g, '');
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\+/g, '');
    if (!hasPlus && defaultCountryCode && cleaned) {
      return defaultCountryCode.replace(/[^\d+]/g, '').replace(/^\+?/, '+') + cleaned;
    }
    return (hasPlus ? '+' : '') + cleaned;
  }

  // Group digits in 3s after the country code for display only.
  let display = $derived(formatDisplay(value));
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

  function handleInput(e: Event) {
    const next = sanitize((e.target as HTMLInputElement).value);
    value = next;
    onValueChange?.(next);
  }
</script>

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
