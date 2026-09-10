import { describe, expect, it } from 'vitest';
import { apartxCompat } from './vite-plugin.js';

describe('vite-plugin', () => {
  it('обрабатывает .css и игнорирует остальное', () => {
    const plugin = apartxCompat();
    expect(plugin.transform('@layer a { .x { color: red } }', '/app/app.css').code).not.toContain('@layer');
    expect(plugin.transform('const a = 1', '/app/main.js')).toBeNull();
  });

  it('обрабатывает css с query-суффиксом Vite', () => {
    const plugin = apartxCompat();
    expect(plugin.transform('@layer a { .x { color: red } }', '/app/app.css?direct').code).not.toContain('@layer');
  });

  it('встаёт последним в цепочке плагинов', () => {
    expect(apartxCompat().enforce).toBe('post');
  });
});
