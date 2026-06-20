import { describe, expect, it } from 'vitest';
import { detectMobileOS } from './os';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('detectMobileOS', () => {
  it('classifies iPhone as ios', () => expect(detectMobileOS(IPHONE)).toBe('ios'));
  it('classifies iPad (classic UA) as ios', () => expect(detectMobileOS(IPAD)).toBe('ios'));
  it('classifies Android as android', () => expect(detectMobileOS(ANDROID)).toBe('android'));
  it('classifies desktop Chrome as other', () => expect(detectMobileOS(DESKTOP_CHROME)).toBe('other'));
  it('classifies desktop Safari (Mac) as other', () => expect(detectMobileOS(DESKTOP_SAFARI)).toBe('other'));
  it('treats empty UA (SSR) as other', () => expect(detectMobileOS('')).toBe('other'));
});
