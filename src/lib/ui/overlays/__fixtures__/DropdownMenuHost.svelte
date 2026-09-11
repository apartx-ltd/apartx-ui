<script lang="ts">
  // Тестовый хост: сниппеты триггера и тела задаёт только родитель. Для dropdown-menu.dom.test.ts.
  // Триггер — span, а не кнопка: bits-триггер сам <button>, вложенная кнопка в тесте ни к чему.
  import DropdownMenu from '../DropdownMenu.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<DropdownMenu bind:open class="host-wrapper" data-testid="dd-wrapper">
  {#snippet trigger()}<span data-testid="dd-trigger">Menu</span>{/snippet}
  <button type="button" data-testid="dd-item">Item</button>
</DropdownMenu>
