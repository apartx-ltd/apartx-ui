<script>
  // Диспетчер media-слота для всех четырёх медиа-типов (image/video/audio/document).
  //
  // ИНВАРИАНТ: весь сегодняшний трафик (telegram, whatsapp, аплоады кабинета) — ОДНО вложение на
  // сообщение, и вместе с ним живут оптимистичные состояния отправки (`message.sendState`,
  // `meta.status`, `meta.uploadProgress`, `meta.previewUrl`), которых у альбома нет и быть не может
  // (альбом приходит уже сохранённым с сервера). Поэтому одиночное вложение НЕ рисуется альбомным
  // кодом, а делегируется прежнему компоненту БЕЗ изменений — весь набор пропсов уходит туда
  // спредом, чтобы ни один оптимистичный проп по дороге не потерялся.
  import ImageMedia from './ImageMedia.svelte';
  import VideoMedia from './VideoMedia.svelte';
  import AudioMedia from './AudioMedia.svelte';
  import DocumentMedia from './DocumentMedia.svelte';
  import AlbumMedia from './AlbumMedia.svelte';
  import { messageAttachments, isFullBleedMedia } from '../helpers';

  let props = $props();

  /** @type {Record<string, any>} */
  const SINGLE = { image: ImageMedia, video: VideoMedia, audio: AudioMedia, document: DocumentMedia };

  const single = $derived(messageAttachments(props.message).length <= 1);
  // Фолбэк по признаку full-bleed: хост может зарегистрировать этот слот и на свой тип сообщения
  // (например 'photo'), которого в карте нет — тогда решает та же классификация, что и у пузыря.
  const Single = $derived(
    SINGLE[props.message?.type] ?? (isFullBleedMedia(props.message?.type) ? ImageMedia : DocumentMedia),
  );
</script>

{#if single}
  <Single {...props} />
{:else}
  <AlbumMedia {...props} />
{/if}
