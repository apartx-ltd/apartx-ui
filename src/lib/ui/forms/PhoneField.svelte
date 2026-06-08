<script lang="ts">
  import TextField from './TextField.svelte';
  import CountrySelect from './CountrySelect.svelte';

  /**
   * Phone entry widget: a country selector button, a dialing-code field and a
   * national-number field. Data-agnostic — pass the country list (e.g.
   * `countryPhoneData` from the `phone` package). Binds `countryCode` (with a
   * leading `+`) and `phoneNumber` (national digits) back to the consumer.
   */
  type Country = {
    country_name: string;
    country_code: string | number;
    alpha2?: string;
    alpha3?: string;
    [k: string]: unknown;
  };

  let {
    countryCode = $bindable('+7'),
    phoneNumber = $bindable(''),
    countries = [],
    phoneError = '',
    countryCodeLabel = 'Country code',
    phoneNumberLabel = 'Phone number',
    chooseCountryLabel = 'Choose country',
    invalidCountryLabel = 'Invalid country code',
    searchPlaceholder = 'Search',
  }: {
    countryCode?: string;
    phoneNumber?: string;
    countries?: Country[];
    phoneError?: string;
    countryCodeLabel?: string;
    phoneNumberLabel?: string;
    chooseCountryLabel?: string;
    invalidCountryLabel?: string;
    searchPlaceholder?: string;
  } = $props();

  let modalOpen = $state(false);

  const selectedCountry = $derived.by(() => {
    const code = countryCode.replace('+', '');
    if (!code) return { country_name: chooseCountryLabel };
    const found = countries.find((c) => String(c.country_code) === code);
    return found ?? { country_name: invalidCountryLabel };
  });

  const countryDisplay = $derived(selectedCountry.country_name ?? chooseCountryLabel);

  function onCountryChosen(country?: Country) {
    if (!country) return;
    countryCode = '+' + country.country_code;
  }
</script>

<div class="flex flex-col gap-3">
  <button
    type="button"
    class="border-outline hover:border-on-surface text-body-lg text-on-surface h-12 cursor-pointer rounded-xs border bg-transparent px-3 text-left"
    onclick={() => (modalOpen = true)}
  >
    {countryDisplay}
  </button>

  <div class="flex gap-2">
    <div class="w-24">
      <TextField bind:value={countryCode} label={countryCodeLabel} type="tel" />
    </div>
    <div class="flex-1">
      <TextField bind:value={phoneNumber} label={phoneNumberLabel} type="tel" error={phoneError} />
    </div>
  </div>
</div>

<CountrySelect
  bind:open={modalOpen}
  {countries}
  onselect={onCountryChosen}
  title={chooseCountryLabel}
  {searchPlaceholder}
/>
