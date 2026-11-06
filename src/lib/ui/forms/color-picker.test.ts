import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLOR_PALETTE, normalizeHex, contrastRatio, contrastTextColor, mutedHex,
} from './color-picker';

describe('color-picker helpers', () => {
  it('normalizes hex', () => {
    expect(normalizeHex('#FF5A5F')).toBe('#ff5a5f');
    expect(normalizeHex('ff5a5f')).toBe('#ff5a5f');
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });
  it('picks text color by contrast', () => {
    expect(contrastTextColor('#003580')).toBe('#ffffff');
    expect(contrastTextColor('#fbc02d')).toBe('#1c1b1f');
  });
  it('every default swatch holds white text at ≥ 3:1', () => {
    expect(DEFAULT_COLOR_PALETTE).toHaveLength(16);
    for (const c of DEFAULT_COLOR_PALETTE) expect(contrastRatio(c, '#ffffff'), c).toBeGreaterThanOrEqual(3);
  });
  it('keeps the colors the cabinet e2e relies on', () => {
    for (const c of ['#1e88e5', '#9c27b0', '#003580']) expect(DEFAULT_COLOR_PALETTE).toContain(c);
  });
  it('mutes a hex to rgba', () => { expect(mutedHex('#003580', 0.4)).toBe('rgba(0,53,128,0.4)'); });
});
