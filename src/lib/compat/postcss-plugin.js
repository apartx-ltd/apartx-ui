import postcss from 'postcss';
import { compatCss } from './compat-css.js';

/**
 * PostCSS-адаптер компат-слоя. Ставится в postcss.config.js ПОСЛЕ '@tailwindcss/postcss':
 * работает по готовому выводу Tailwind, а не по исходникам.
 *
 * OnceExit — последний хук прохода, к этому моменту дерево окончательное. Карты исходников после
 * прогона через Lightning CSS теряются; для CSS в деве это некритично.
 */
const plugin = () => ({
  postcssPlugin: 'apartx-compat',
  OnceExit(root, { result }) {
    const css = compatCss(root.toString(), { from: result.opts.from ?? 'compat.css' });
    root.removeAll();
    root.append(postcss.parse(css));
  },
});

plugin.postcss = true;

export default plugin;
