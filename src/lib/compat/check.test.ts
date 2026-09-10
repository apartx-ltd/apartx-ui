import { describe, expect, it } from 'vitest';
import { collectCssProblems } from './check.js';

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

  it('ловит :has()', () => {
    expect(collectCssProblems('a.css', '.x:has(.y) { color: red }')).toHaveLength(1);
  });

  it('молчит на чистом CSS', () => {
    expect(collectCssProblems('a.css', '.x { color: #fff; display: flex }')).toHaveLength(0);
  });
});
