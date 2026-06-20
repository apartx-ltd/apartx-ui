import { defineConfig } from 'vitest/config';

// Pure-unit config: node env, no SvelteKit plugin (the util under test has no
// Svelte/DOM deps). Component/visual checks live in svelte-check + the apps.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
