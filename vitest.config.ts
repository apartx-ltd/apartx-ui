import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const kitRuntime = (p: string) => fileURLToPath(new URL(`./node_modules/@sveltejs/kit/${p}`, import.meta.url));

// node env + svelte plugin: pure-.ts suites run as before; rune-bearing `.svelte.ts`
// modules (composer/session) are compiled so their $state getters work under test.
// `conditions: ['browser']` resolves svelte to its CLIENT runtime — required by suites that
// mount() real components (cache-shape.test.ts runs under a jsdom pragma); without it the node
// export condition picks index-server.js where mount() throws lifecycle_function_unavailable.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      // sveltekit.test.ts is the one file allowed to import '$app/*' (mirrors
      // sveltekit.ts's own carve-out, see CLAUDE.md). Vite has no idea what '$app/*'
      // means without the full `sveltekit()` plugin (which this bare vitest config
      // doesn't load), so `import('$app/navigation')` fails resolution before vi.mock
      // ever gets a chance to intercept it. Alias to real (but never executed) kit
      // runtime files just so resolution succeeds — sveltekit.test.ts's `vi.mock(...)`
      // fully replaces their contents at runtime, so what they point to doesn't matter.
      '$app/navigation': kitRuntime('src/runtime/app/navigation.js'),
      '$app/state': kitRuntime('src/runtime/app/state/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
