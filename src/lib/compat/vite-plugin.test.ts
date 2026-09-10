import { describe, expect, it } from 'vitest';
import { apartxCompat } from './vite-plugin.js';

// Хуки зовём напрямую: поднимать vite ради проверки двух веток дороже, чем оно того стоит.
const dev = () => {
  const plugin = apartxCompat();
  plugin.configResolved({ command: 'serve' });
  return plugin;
};

const build = () => {
  const plugin = apartxCompat();
  plugin.configResolved({ command: 'build' });
  return plugin;
};

describe('vite-plugin', () => {
  it('в dev обрабатывает .css и игнорирует остальное', () => {
    expect(dev().transform('@layer a { .x { color: red } }', '/app/app.css').code).not.toContain('@layer');
    expect(dev().transform('const a = 1', '/app/main.js')).toBeNull();
  });

  it('в dev обрабатывает css с query-суффиксом Vite', () => {
    expect(dev().transform('@layer a { .x { color: red } }', '/app/app.css?direct').code).not.toContain('@layer');
  });

  it('в сборке transform молчит — там работает generateBundle', () => {
    expect(build().transform('@layer a { .x { color: red } }', '/app/app.css')).toBeNull();
  });

  it('generateBundle правит css-ассеты и не трогает чанки', () => {
    const bundle = {
      'assets/app.css': { type: 'asset', source: '@layer a { .x { color: red } }' },
      'assets/app.js': { type: 'chunk', code: 'const a = "@layer"' },
      'assets/logo.svg': { type: 'asset', source: '<svg/>' },
    };
    build().generateBundle({}, bundle);
    expect(bundle['assets/app.css'].source).not.toContain('@layer');
    expect(bundle['assets/app.js'].code).toContain('@layer');
    expect(bundle['assets/logo.svg'].source).toBe('<svg/>');
  });

  it('generateBundle принимает Buffer-ассет', () => {
    const bundle = { 'assets/app.css': { type: 'asset', source: Buffer.from('@layer a { .x { color: red } }') } };
    build().generateBundle({}, bundle);
    expect(String(bundle['assets/app.css'].source)).not.toContain('@layer');
  });

  it('встаёт последним в цепочке плагинов', () => {
    expect(apartxCompat().enforce).toBe('post');
  });
});
