<script lang="ts">
  // Тестовый хост для color-palette.dom.test.ts: bind:value + вывод значения.
  import ColorPalette from '../ColorPalette.svelte';

  let { value = $bindable(null), defaultValue = '#003580' }: { value?: string | null; defaultValue?: string } = $props();
</script>

<ColorPalette bind:value {defaultValue} />
<output data-testid="val">{String(value)}</output>
