<script>
  // Document media — kit default slot for the `document` message type: icon + name + size + download.
  // Not full-bleed — renders in the normal padded stacked bubble. `t` is injected via the kit slot
  // context (host), mirroring MessageHeaderDefault.
  import Icon from '../../ui/display/Icon.svelte';
  import { faFile, faDownload } from '@fortawesome/free-solid-svg-icons';

  let { message, me, t } = $props();
  let file = $derived(message.meta?.file);

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
