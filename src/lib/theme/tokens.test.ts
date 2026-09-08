import { describe, it, expect } from 'vitest';
import { generateTokens } from './tokens';

describe('generateTokens', () => {
  it('в светлой теме отдаёт сид как акцент, а не приглушённый M3-тон', () => {
    expect(generateTokens('#1976d2').light['--theme-primary']).toBe('#1976d2');
  });

  it('в тёмной теме осветляет акцент по правилу M3', () => {
    expect(generateTokens('#1976d2').dark['--theme-primary']).toBe('#a5c8ff');
  });

  it('отдаёт нейтральные поверхности без подтона', () => {
    const { light, dark } = generateTokens('#1976d2');
    expect(light['--theme-surface']).toBe('#f9f9f9');
    expect(dark['--theme-surface']).toBe('#131313');
    expect(light['--theme-surface-container']).toBe('#eeeeee');
  });

  it('на бесцветном сиде не уезжает в розовый', () => {
    expect(generateTokens('#000000').light['--theme-primary']).toBe('#000000');
  });
});
