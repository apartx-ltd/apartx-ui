<script lang="ts">
  import { base } from '$app/paths';
  import { marked } from 'marked';
  import readme from '../../README.md?raw';

  // Rendered at build time (route is prerendered). Trusted, in-repo content.
  const html = marked.parse(readme, { gfm: true }) as string;
</script>

<div class="mx-auto max-w-3xl">
  <div class="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-variant/40 px-5 py-4">
    <div>
      <div class="text-title-md text-primary">Component docs</div>
      <div class="text-body-sm text-on-surface-variant">Live playground for every component & hook.</div>
    </div>
    <a
      href="{base}/display"
      class="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-label-lg text-on-primary transition-shadow hover:shadow-level-2"
    >
      Browse components →
    </a>
  </div>

  <article class="prose-readme">
    {@html html}
  </article>
</div>

<style>
  /* Minimal prose styling for the rendered README, themed via M3 tokens. */
  .prose-readme :global(h1) {
    font-size: 2rem;
    line-height: 2.5rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }
  .prose-readme :global(h2) {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 600;
    margin: 2rem 0 0.75rem;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid var(--color-outline-variant);
  }
  .prose-readme :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1.5rem 0 0.5rem;
  }
  .prose-readme :global(p),
  .prose-readme :global(li) {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-on-surface-variant);
  }
  .prose-readme :global(ul),
  .prose-readme :global(ol) {
    margin: 0.5rem 0 1rem;
    padding-left: 1.5rem;
    list-style: disc;
  }
  .prose-readme :global(ol) {
    list-style: decimal;
  }
  .prose-readme :global(li) {
    margin: 0.25rem 0;
  }
  .prose-readme :global(a) {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .prose-readme :global(strong) {
    color: var(--color-on-surface);
    font-weight: 600;
  }
  .prose-readme :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.875em;
    background: var(--color-surface-variant);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }
  .prose-readme :global(pre) {
    background: var(--color-inverse-surface);
    color: var(--color-inverse-on-surface);
    padding: 1rem 1.25rem;
    border-radius: 12px;
    overflow-x: auto;
    margin: 1rem 0;
  }
  .prose-readme :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .prose-readme :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.9rem;
  }
  .prose-readme :global(th),
  .prose-readme :global(td) {
    border: 1px solid var(--color-outline-variant);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }
  .prose-readme :global(th) {
    background: var(--color-surface-variant);
    font-weight: 600;
  }
  .prose-readme :global(blockquote) {
    border-left: 3px solid var(--color-primary);
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--color-on-surface-variant);
  }
  .prose-readme :global(hr) {
    border: 0;
    border-top: 1px solid var(--color-outline-variant);
    margin: 2rem 0;
  }
</style>
