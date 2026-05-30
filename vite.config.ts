import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0'
	},
	ssr: {
		// This package uses extensionless internal imports that Node's ESM
		// resolver rejects during SSR — let Vite bundle/resolve it instead.
		noExternal: ['@material/material-color-utilities']
	}
});
