import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { apartxCompat } from './vite-plugin.js';

const [serve, build] = apartxCompat();

describe('vite-plugin: хуки', () => {
  it('serve обрабатывает .css и игнорирует остальное', () => {
    expect(serve.transform('@layer a { .x { color: red } }', '/app/app.css').code).not.toContain('@layer');
    expect(serve.transform('const a = 1', '/app/main.js')).toBeNull();
  });

  it('serve обрабатывает css с query-суффиксом Vite', () => {
    expect(serve.transform('@layer a { .x { color: red } }', '/app/app.css?direct').code).not.toContain('@layer');
    expect(serve.transform('@layer a { .x { color: red } }', '/app/C.svelte?svelte&type=style&lang.css').code).not.toContain('@layer');
  });

  it('serve пропускает css-модули, которые уже JS', () => {
    expect(serve.transform('export default "@layer a {}"', '/app/app.css?raw')).toBeNull();
    expect(serve.transform('export default "/app/app.css"', '/app/app.css?url')).toBeNull();
  });

  it('generateBundle правит css-ассеты и не трогает чанки', () => {
    const bundle = {
      'assets/app.css': { type: 'asset', source: '@layer a { .x { color: red } }' },
      'assets/app.js': { type: 'chunk', code: 'const a = "@layer"' },
      'assets/logo.svg': { type: 'asset', source: '<svg/>' },
    };
    build.generateBundle({}, bundle);
    expect(bundle['assets/app.css'].source).not.toContain('@layer');
    expect(bundle['assets/app.js'].code).toContain('@layer');
    expect(bundle['assets/logo.svg'].source).toBe('<svg/>');
  });

  it('generateBundle принимает Buffer-ассет', () => {
    const bundle = { 'assets/app.css': { type: 'asset', source: Buffer.from('@layer a { .x { color: red } }') } };
    build.generateBundle({}, bundle);
    expect(String(bundle['assets/app.css'].source)).not.toContain('@layer');
  });

  // Взаимоисключающие стадии — гарантия от двойного прохода (дубли фолбэков единиц).
  it('у dev-плагина нет хука сборки и наоборот', () => {
    expect(serve).toMatchObject({ apply: 'serve' });
    expect(serve.enforce).toBeUndefined();
    expect(serve.generateBundle).toBeUndefined();
    expect(build).toMatchObject({ apply: 'build', enforce: 'post' });
    expect(build.transform).toBeUndefined();
  });
});

// Настоящий dev-сервер: порядок относительно `vite:css` / `vite:css-post` хуками не проверить.
// С `enforce: 'post'` здесь падало `Unknown word` — compat получал уже JS-обёртку.
describe('vite-plugin: dev-сервер с Tailwind', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      root: fileURLToPath(new URL('./__fixtures__', import.meta.url)),
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [tailwindcss(), apartxCompat()],
    });
  });

  afterAll(() => server?.close());

  const expectCompat = (css: string) => {
    expect(css).toContain('display: flex'); // сгенерированная Tailwind'ом утилита доехала
    expect(css).not.toContain('@layer');
    expect(css).toMatch(/height: 100vh;\s*height: 100dvh/);
  };

  it('css-модуль клиента', async () => {
    const result = await server.transformRequest('/app.css');
    expect(result?.code).toContain('__vite__updateStyle');
    expectCompat(JSON.parse(result!.code.match(/const __vite__css = (".*")/)![1]));
  });

  it('?inline в SSR', async () => {
    const mod = await server.ssrLoadModule('/app.css?inline');
    expectCompat(mod.default);
  });
});
