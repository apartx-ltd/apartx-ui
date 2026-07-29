<script>
  // Document media — kit default slot for the `document` message type: icon + name + size + download.
  // Not full-bleed — renders in the normal padded stacked bubble. `t` is injected via the kit slot
  // context (host), mirroring MessageHeaderDefault.
  // Сама строка живёт в DocumentRow — её же переиспользует альбом (AlbumMedia), поэтому одиночный
  // документ и документ внутри альбома гарантированно выглядят одинаково.
  import DocumentRow from './DocumentRow.svelte';

  let { message, me, t } = $props();
  let file = $derived(message.meta?.file);
</script>

<DocumentRow {file} {me} {t} />
