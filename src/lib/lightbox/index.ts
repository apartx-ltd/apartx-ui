// Lightbox (viewerjs). Heavy dep kept behind its own subpath
// (`apartx-ui/lightbox`) so consumers that don't need an image viewer don't
// pull in viewerjs. Declarative wrapper — viewerjs is an implementation detail;
// drive it with `images` + `bind:open` / `bind:index`.
export { default as Lightbox } from './Lightbox.svelte';
// Full-screen video player (media-chrome). Lazy-loads media-chrome on mount; independent of viewerjs.
export { default as VideoLightbox } from './VideoLightbox.svelte';
