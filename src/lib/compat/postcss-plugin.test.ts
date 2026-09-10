import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import compatPlugin from './postcss-plugin.js';

describe('postcss-plugin', () => {
  it('разворачивает слои в цепочке PostCSS', async () => {
    const { css } = await postcss([compatPlugin()]).process('@layer a { .x { color: red } }', { from: 'test.css' });
    expect(css).not.toContain('@layer');
    expect(css).toContain('.x');
  });

  it('прокидывает наружу ошибку порядка слоёв', async () => {
    await expect(
      postcss([compatPlugin()]).process('.stray { color: red }\n@layer a { .x { color: blue } }', { from: 'test.css' }),
    ).rejects.toThrow(/разворачивание изменит каскад/);
  });
});
