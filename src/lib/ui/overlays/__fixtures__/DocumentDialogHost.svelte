<script lang="ts">
  import DocumentDialog from '../DocumentDialog.svelte';

  let {
    html = '',
    loading = false,
    error = false,
    onretry = () => {},
    ondownload = undefined,
  }: {
    html?: string;
    loading?: boolean;
    error?: boolean;
    onretry?: () => void;
    ondownload?: () => Promise<void>;
  } = $props();
</script>

<DocumentDialog
  open={true}
  title="Doc"
  {html}
  {loading}
  {error}
  {onretry}
  {ondownload}
  downloadLabel="Download"
  retryLabel="Retry"
  errorText="Failed"
  respectBack={false}
/>
