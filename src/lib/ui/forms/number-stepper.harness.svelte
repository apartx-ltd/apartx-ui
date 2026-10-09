<script>
  import NumberStepper from './NumberStepper.svelte';

  let { min = 1, max = 3, initial = 2, disabled = false } = $props();
  let value = $state(initial);
</script>

<NumberStepper bind:value {min} {max} {disabled} data-testid="stepper" />
<output data-testid="out">{value}</output>
