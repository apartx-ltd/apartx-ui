import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBuild, collectCssProblems } from './check.js';

describe('collectCssProblems', () => {
  it('ловит @layer', () => {
    expect(collectCssProblems('a.css', '@layer a { .x { color: red } }')).toHaveLength(1);
  });

  it('ловит color-mix вне @supports', () => {
    expect(collectCssProblems('a.css', '.x { color: color-mix(in oklab, red 50%, transparent) }')).toHaveLength(1);
  });

  it('пропускает color-mix внутри @supports', () => {
    const css =
      '@supports (color: color-mix(in lab, red, red)) { .x { color: color-mix(in oklab, red 50%, transparent) } }';
    expect(collectCssProblems('a.css', css)).toHaveLength(0);
  });

  it('ловит dvh без фолбэка и пропускает с фолбэком', () => {
    expect(collectCssProblems('a.css', '.x { height: 100dvh }')).toHaveLength(1);
    expect(collectCssProblems('a.css', '.x { height: 100vh; height: 100dvh }')).toHaveLength(0);
  });

  it('видит фолбэк, отделённый чужим объявлением', () => {
    // Ровно то, что делает lightningcss с #app: между двумя height вклинивается flex-direction.
    expect(collectCssProblems('a.css', '.x { height: 100vh; flex-direction: column; height: 100dvh }')).toHaveLength(0);
  });

  it('ловит :has()', () => {
    expect(collectCssProblems('a.css', '.x:has(.y) { color: red }')).toHaveLength(1);
  });

  it('молчит на чистом CSS', () => {
    expect(collectCssProblems('a.css', '.x { color: #fff; display: flex }')).toHaveLength(0);
  });
});

describe('checkBuild', () => {
  // Раскладка мимикрирует бандл Meteor: `app/` — это скопированный байт в байт `public/`
  // (чужие скины), `app/build-chunks/` — то, что сгенерировал rspack через postcss.
  const makeBundle = ({ vendorCss, chunkCss }: { vendorCss: string; chunkCss: string }) => {
    const root = mkdtempSync(join(tmpdir(), 'compat-check-'));
    mkdirSync(join(root, 'app', 'tinymce'), { recursive: true });
    mkdirSync(join(root, 'app', 'build-chunks'), { recursive: true });
    writeFileSync(join(root, 'app', 'tinymce', 'skin.css'), vendorCss);
    writeFileSync(join(root, 'app', 'build-chunks', 'main.css'), chunkCss);
    writeFileSync(join(root, 'bundle.js'), "globalThis['apartx-compat-polyfills'] = true;");
    return root;
  };

  it('не считает проблемой чужие ассеты из public/', () => {
    const root = makeBundle({ vendorCss: '.tox:has(.y) { color: red }', chunkCss: '.x { color: #fff }' });
    expect(checkBuild([root])).toHaveLength(0);
  });

  it('но проверяет сгенерированное в build-chunks', () => {
    const root = makeBundle({ vendorCss: '.x { color: #fff }', chunkCss: '.x:has(.y) { color: red }' });
    expect(checkBuild([root])).toHaveLength(1);
  });

  it('требует маркер полифилов', () => {
    const root = mkdtempSync(join(tmpdir(), 'compat-check-'));
    writeFileSync(join(root, 'bundle.js'), 'console.log(1)');
    expect(checkBuild([root])).toEqual([expect.stringContaining('apartx-compat-polyfills')]);
  });
});
