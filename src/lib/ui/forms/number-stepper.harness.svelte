<script>
  import NumberStepper from './NumberStepper.svelte';

  let { min = 1, max = 3, initial = 2, disabled = false, ...rest } = $props();
  // снимок начального значения; дальше value принадлежит харнессу через bind
  let value = $state(initial);
</script>

<NumberStepper bind:value {min} {max} {disabled} data-testid="stepper" {...rest} />
<output data-testid="out">{value}</output>
