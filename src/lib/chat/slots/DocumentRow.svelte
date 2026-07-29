<script>
  // Одна строка вложения-документа: иконка + имя + размер + скачивание. Выделена из DocumentMedia,
  // потому что теперь её рисуют ДВА места — одиночный документ (DocumentMedia) и хвост документов
  // под сеткой альбома (AlbumMedia); общий кусок разметки не даёт им разъехаться при правках стилей.
  // Разметка и классы намеренно перенесены байт-в-байт — одиночный документ обязан выглядеть как до
  // выделения. `t` инжектится через kit slot context (host), как в MessageHeaderDefault.
  import Icon from '../../ui/display/Icon.svelte';
  import { faFile, faDownload } from '@fortawesome/free-solid-svg-icons';

  let { file, me, t } = $props();

  /** @param {number | undefined} bytes */
  function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
</script>

{#if file}
  <div class="px-3 pt-2">
    <a
      href={file.url}
      target="_blank"
      rel="noopener"
      download={file.name || 'document'}
      class="flex items-center gap-2 {me ? 'text-white/90' : 'text-primary'} hover:underline"
    >
      <Icon icon={faFile} />
      <span class="flex-1 min-w-0">
        <span class="block text-body-sm font-medium truncate">{file.name || (t ? t('common.document.title') : 'Document')}</span>
        {#if file.size}<span class="block text-label-sm opacity-70">{formatFileSize(file.size)}</span>{/if}
      </span>
      <Icon icon={faDownload} />
    </a>
  </div>
{/if}
