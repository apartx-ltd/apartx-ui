import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// node env + svelte plugin: pure-.ts suites run as before; rune-bearing `.svelte.ts`
// modules (composer/session) are compiled so their $state getters work under test.
// `conditions: ['browser']` resolves svelte to its CLIENT runtime — required by suites that
// mount() real components (cache-shape.test.ts runs under a jsdom pragma); without it the node
// export condition picks index-server.js where mount() throws lifecycle_function_unavailable.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
