// Client-only navigation demo: it drives SvelteKit's client router (push/back,
// shallow-routing overlay entries) and reads live url state, so it can't be
// prerendered. Override the root layout's prerender=true for this subtree.
export const prerender = false;
export const ssr = false;
