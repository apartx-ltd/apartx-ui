import { describe, it, expect } from 'vitest';
import { generateTokens } from './tokens';

// Ожидания совпадают с гейтом apartx-brands/theme/brands.generated.test.mjs: кит и
// статика брендов считают одну и ту же палитру.
describe('generateTokens', () => {
  it('в светлой теме берёт акцент с тона сида, но не светлее 42', () => {
    expect(generateTokens('#1976d2').light['--theme-primary']).toBe('#0064b8');
  });

  it('в светлой теме отдаёт нейтральные поверхности без подтона', () => {
    const { light } = generateTokens('#1976d2');
    expect(light['--theme-surface']).toBe('#f9f9f9');
    expect(light['--theme-background']).toBe('#f9f9f9');
    expect(light['--theme-surface-container']).toBe('#eeeeee');
  });

  it('в тёмной теме берёт акцент с тона 72', () => {
    const { dark } = generateTokens('#1976d2');
    expect(dark['--theme-primary']).toBe('#7db3ff');
    expect(dark['--theme-on-primary']).toBe('#00315f');
  });

  it('в тёмной теме — Night: подложка темнее поверхности, серые с подтоном сида', () => {
    const { dark } = generateTokens('#1976d2');
    expect(dark['--theme-background']).toBe('#0f1620');
    expect(dark['--theme-surface']).toBe('#19202b');
    expect(dark['--theme-surface-container']).toBe('#1f2631');
    expect(dark['--theme-surface-container-highest']).toBe('#303743');
    expect(dark['--theme-on-surface']).toBe('#dce3f2');
  });

  it('на бесцветном сиде не уезжает в розовый', () => {
    expect(generateTokens('#000000').light['--theme-primary']).toBe('#000000');
  });

  it('на бесцветном сиде тёмная остаётся серой', () => {
    const { dark } = generateTokens('#000000');
    expect(dark['--theme-background']).toBe('#151515');
    expect(dark['--theme-surface']).toBe('#1f1f1f');
    expect(dark['--theme-surface-container']).toBe('#262626');
    expect(dark['--theme-primary']).toBe('#b0b0b0');
  });
});
