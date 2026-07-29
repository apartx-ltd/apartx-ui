<script>
  // Альбом — несколько вложений в ОДНОМ пузыре: сетка превью (картинки/видео) сверху, строки
  // документов снизу. Выбирается диспетчером MediaAttachments, когда вложений больше одного;
  // одиночное вложение (весь сегодняшний трафик telegram/whatsapp/аплоады) сюда не попадает и
  // рисуется прежними ImageMedia/VideoMedia/AudioMedia/DocumentMedia.
  //
  // Раскладка ОБЯЗАНА совпадать с `albumBoxHeight` (та кормит estimateMessageHeight →
  // VirtualList.estimateSize): 2 колонки, gap = ALBUM_GAP, ширина MEDIA_BOX_MAX, при нечётном числе
  // показанных ячеек первая растянута на обе колонки с соотношением 16:9, остальные квадратные.
  // Ширина и зазор берутся ИЗ ТЕХ ЖЕ констант, чтобы раскладка и оценка высоты не разъехались —
  // иначе при холодном открытии чата поедет скролл.
  import Icon from '../../ui/display/Icon.svelte';
  import { faPlay } from '@fortawesome/free-solid-svg-icons';
  // Прямой импорт файла (НЕ бочка '../../lightbox') — бочка тянет ещё и viewerjs-Lightbox со
  // статическим `viewerjs/dist/viewer.css`, который иначе попал бы в бандл каждого чата.
  // Причина та же, что в VideoMedia.svelte.
  import VideoLightbox from '../../lightbox/VideoLightbox.svelte';
  import DocumentRow from './DocumentRow.svelte';
  import { albumLayout, messageAttachments, formatDuration, createMediaTapGuard, MEDIA_BOX_MAX, ALBUM_GAP } from '../helpers';

  let { message, me, t, openLightbox } = $props();

  const layout = $derived(albumLayout(messageAttachments(message)));

  // Видео открывается СВОИМ лайтбоксом; какой ролик играть — решает нажатая ячейка, поэтому
  // инстанс лайтбокса один на альбом и монтируется только после первого нажатия.
  /** @type {any} */
  let playing = $state(null);
  let playerOpen = $state(false);

  /** @param {any} att */
  function isVideoAtt(att) {
    return typeof att?.type === 'string' && att.type.indexOf('video/') === 0;
  }

  /** @param {any} att */
  function openCell(att) {
    if (!att) return;
    if (isVideoAtt(att)) {
      playing = att;
      playerOpen = true;
      return;
    }
    // Хост ищет индекс по src в своей галерее, а chatImageGallery уже содержит ВСЕ картинки
    // альбома — поэтому сигнатуры `openLightbox(url)` хватает и для «+N»-ячейки.
    if (att.url) openLightbox?.(att.url);
  }

  // Гвард ОДИН на альбом, а не по ячейке: он держит флаг «жест начался с long-press» в замыкании,
  // и пересоздание гварда посреди жеста (перерисовка each-блока) вернуло бы баг двойного открытия.
  // Какая ячейка нажата — запоминаем перед тем, как отдать событие гварду.
  /** @type {any} */
  let pressed = null;
  const tapGuard = createMediaTapGuard(() => openCell(pressed));
</script>

{#if layout.cells.length}
  <div
    class="grid grid-cols-2 bg-surface-container-high"
    style="width:{MEDIA_BOX_MAX}px;max-width:100%;gap:{ALBUM_GAP}px"
    data-testid="chat-album"
  >
    {#each layout.cells as att, i}
      {@const hero = layout.hero && i === 0}
      {@const video = isVideoAtt(att)}
      {@const src = video ? att.posterUrl : att.url}
      {@const duration = video ? formatDuration(att.duration) : ''}
      {@const more = layout.overflow > 0 && i === layout.cells.length - 1}
      <div
        class="relative overflow-hidden bg-surface-container-high {hero ? 'col-span-2 aspect-[16/9]' : 'aspect-square'}"
        data-testid="chat-album-cell"
      >
        {#if src}
          <img {src} alt="" class="h-full w-full object-cover" />
        {/if}
        <button
          type="button"
          onpointerdown={() => { pressed = att; tapGuard.onpointerdown(); }}
          oncontextmenu={tapGuard.oncontextmenu}
          onclick={(e) => { pressed = att; tapGuard.onclick(e); }}
          class="absolute inset-0 grid place-items-center {video ? '' : 'cursor-zoom-in'}"
          aria-label={video ? 'Play video' : 'View image'}
          data-testid="chat-album-tap"
        >
          {#if video}
            <span class="grid h-10 w-10 place-items-center rounded-full bg-scrim/50 text-white">
              <Icon icon={faPlay} size="sm" class="text-white" />
            </span>
          {/if}
        </button>
        {#if duration}
          <span class="pointer-events-none absolute bottom-1 right-1 rounded bg-scrim/60 px-1.5 py-0.5 text-xs text-white">
            {duration}
          </span>
        {/if}
        {#if more}
          <!-- «+N» — лишние превью в сетку не рисуются вовсе; нажатие проходит к кнопке под
               оверлеем (pointer-events-none) и открывает лайтбокс на ЭТОЙ картинке, а в галерее
               хоста есть все остальные. -->
          <span
            class="pointer-events-none absolute inset-0 grid place-items-center bg-scrim/50 text-title-md text-white"
            data-testid="chat-album-more"
          >+{layout.overflow}</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if layout.docs.length}
  <!-- У full-bleed пузыря (image/video) своих паддингов нет — см. Message.svelte: медиа идёт
       edge-to-edge. DocumentRow приносит боковые паддинги сам, снизу добавляем здесь, иначе
       последняя строка липнет к краю пузыря. -->
  <div class="pb-2">
    {#each layout.docs as file, i (file?.fileId ?? file?.url ?? i)}
      <DocumentRow {file} {me} {t} />
    {/each}
  </div>
{/if}

{#if playing}
  <VideoLightbox src={playing.url} poster={playing.posterUrl ?? ''} bind:open={playerOpen} />
{/if}
