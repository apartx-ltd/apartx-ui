import { test, expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';

// Камера подменяется до загрузки страницы: getUserMedia отдаёт поток canvas с нарисованным QR.
// Headless Chromium камеры не имеет, а декодер (BarcodeDetector или jsqr) читает поток как настоящий.
async function fakeCamera(page: Page, text: string) {
  const src = await QRCode.toDataURL(text, { margin: 4, width: 400 });
  await page.addInitScript((dataUrl) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const draw = () => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 640, 480);
        ctx.drawImage(img, 120, 40, 400, 400);
      };
      draw();
      setInterval(draw, 100);
      return canvas.captureStream(10);
    };
  }, src);
}

test('читает QR с камеры и отдаёт текст', async ({ page }) => {
  await fakeCamera(page, 'https://example.com/d/abc123');
  await page.goto('/scanner');
  await expect(page.getByTestId('scanner-text')).toHaveText('https://example.com/d/abc123', { timeout: 15_000 });
});

test('отказ в доступе к камере — denied', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.goto('/scanner');
  await expect(page.getByTestId('scanner-error')).toHaveText('denied');
});
