import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// node env + svelte plugin: pure-.ts suites run as before; rune-bearing `.svelte.ts`
// modules (composer/session) are compiled so their $state getters work under test.
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
