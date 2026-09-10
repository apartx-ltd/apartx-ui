import { describe, expect, it } from 'vitest';

// Реализации — core-js, их корректность проверяет core-js. Здесь проверяем наше: что модуль
// вообще грузится (все точечные пути core-js существуют — опечатка в пути уронит импорт) и
// что он оставляет рантайм-маркер, по которому compat:check и харнес устройства видят полифилы.
describe('polyfills', () => {
  it('грузится и оставляет строковый маркер для compat:check', async () => {
    await import('./polyfills.js');
    expect((globalThis as Record<string, unknown>)['apartx-compat-polyfills']).toBe(true);
  });

  it('держит спецификацию там, где самописная версия ошибалась', async () => {
    await import('./polyfills.js');
    expect('a-b'.replaceAll('-', '[$&]')).toBe('a[-]b');
    expect(() => structuredClone({ f() {} })).toThrow();
    expect(structuredClone(new Uint8Array([1]))).toBeInstanceOf(Uint8Array);
  });
});
