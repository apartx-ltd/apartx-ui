<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { cn } from '../ui/utils/cn';
  import type { QrScannerError } from './types';

  /**
   * Сканер QR с камеры: видео на весь контейнер, рамка видоискателя, подпись снизу.
   * Отдаёт сырой текст — смысл QR решает хост. Декодер — BarcodeDetector, где он умеет
   * qr_code; иначе jsqr (optional peer, грузится лениво). Тики — самоперепланирующийся
   * setTimeout: без наложения, цикл умирает вместе с компонентом.
   * Один и тот же текст подряд не шлётся, пока хост не переключит paused: наклейка перед
   * камерой иначе стреляла бы пять раз в секунду.
   *
   * @example
   * <QrScanner onscan={(text) => open(text)} paused={busy}>
   *   {#snippet hint()}Point the camera at a QR code{/snippet}
   * </QrScanner>
   */
  let {
    onscan,
    onerror,
    paused = false,
    hint,
    class: className,
    ...restProps
  }: {
    onscan: (text: string) => void;
    onerror?: (kind: QrScannerError) => void;
    paused?: boolean;
    hint?: Snippet;
    class?: string;
    [key: string]: unknown;
  } = $props();

  let video: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let stopped = false;
  let last: string | null = null;

  $effect(() => {
    if (paused) last = null;
  });

  function errorKind(error: unknown): QrScannerError {
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    return 'unavailable';
  }

  async function createDecoder(): Promise<(source: HTMLVideoElement) => Promise<string | null>> {
    const Detector = (window as any).BarcodeDetector;
    const formats: string[] = Detector ? await Detector.getSupportedFormats().catch(() => []) : [];
    if (formats.includes('qr_code')) {
      const detector = new Detector({ formats: ['qr_code'] });
      return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
    }
    const jsQR = (await import('jsqr')).default;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    return async (source) => {
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      ctx.drawImage(source, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height)?.data ?? null;
    };
  }

  function tick(decode: (source: HTMLVideoElement) => Promise<string | null>) {
    setTimeout(async () => {
      if (stopped) return;
      if (!paused && video.readyState >= 2) {
        const text = await decode(video).catch(() => null);
        if (text && text !== last && !paused && !stopped) {
          last = text;
          onscan(text);
        }
      }
      tick(decode);
    }, 200);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onerror?.('unsupported');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (error) {
      if (!stopped) onerror?.(errorKind(error));
      return;
    }
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    tick(await createDecoder());
  }

  onMount(() => {
    void start();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  });
</script>

<!-- Поверх камеры всегда темно — белые уголки и подпись от темы не зависят. Затемнение вне рамки —
     спред box-shadow самой рамки: одна фигура, без масок. -->
<div class={cn('relative overflow-hidden bg-black', className)} {...restProps}>
  <video bind:this={video} class="absolute inset-0 size-full object-cover" playsinline muted autoplay></video>
  <div class="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
    <div class="relative aspect-square w-full max-w-72 rounded-3xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]">
      <span class="absolute -left-0.5 -top-0.5 size-12 rounded-tl-3xl border-l-4 border-t-4 border-white"></span>
      <span class="absolute -right-0.5 -top-0.5 size-12 rounded-tr-3xl border-r-4 border-t-4 border-white"></span>
      <span class="absolute -bottom-0.5 -left-0.5 size-12 rounded-bl-3xl border-b-4 border-l-4 border-white"></span>
      <span class="absolute -bottom-0.5 -right-0.5 size-12 rounded-br-3xl border-b-4 border-r-4 border-white"></span>
    </div>
    {#if hint}
      <div class="relative text-center text-body-md text-white">{@render hint()}</div>
    {/if}
  </div>
</div>
