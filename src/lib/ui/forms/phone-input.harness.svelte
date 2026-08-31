<script lang="ts">
  // Test harness for PhoneInput: owns the bound value the way a real consumer
  // does, so the dom test exercises the two-way binding rather than a snapshot
  // of props.
  import { onMount } from 'svelte';
  import PhoneInput from './PhoneInput.svelte';
  import type { PhoneCountry, TrunkRule, PhoneSplit } from './phone-country';

  let {
    countries = [],
    trunkRule,
    defaultCountryCode = '',
    onParsed,
    read,
  }: {
    countries?: PhoneCountry[];
    trunkRule?: TrunkRule;
    defaultCountryCode?: string;
    onParsed?: (p: PhoneSplit) => void;
    /** Handed a getter so the test can read the current bound value at any time. */
    read?: (get: () => string) => void;
  } = $props();

  let value = $state('');

  onMount(() => read?.(() => value));
</script>

<PhoneInput
  bind:value
  label="Phone"
  {countries}
  {trunkRule}
  {defaultCountryCode}
  {onParsed}
  data-testid="phone"
/>
