<script lang="ts">
  import { QrScanner, type QrScannerError } from '$lib/scanner';

  let text = $state('');
  let error = $state<QrScannerError | ''>('');
</script>

<div class="flex flex-col gap-4 p-4">
  <h1 class="text-headline-sm">QrScanner</h1>
  <QrScanner class="h-96 rounded-xl" onScan={(value) => (text = value)} onError={(kind) => (error = kind)}>
    {#snippet hint()}Point the camera at a QR code{/snippet}
  </QrScanner>
  <p>Text: <span data-testid="scanner-text">{text}</span></p>
  <p>Error: <span data-testid="scanner-error">{error}</span></p>
</div>
