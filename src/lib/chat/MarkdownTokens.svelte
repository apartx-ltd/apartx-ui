<script lang="ts">
  // Recursive marked-token renderer. NO {@html} anywhere: 'html' and unknown
  // token types fall through to literal text — that IS the sanitization.
  import MarkdownTokens from './MarkdownTokens.svelte';
  import MessageLink from './MessageLink.svelte';

  let { tokens = [] }: { tokens?: any[] } = $props();
  let revealed = $state<Record<number, boolean>>({});
</script>

{#each tokens as token, i}
  {#if token.type === 'paragraph'}
    <p class="my-0"><MarkdownTokens tokens={token.tokens} /></p>
  {:else if token.type === 'text'}
    {#if token.tokens?.length}<MarkdownTokens tokens={token.tokens} />{:else}{token.text}{/if}
  {:else if token.type === 'strong'}
    <strong><MarkdownTokens tokens={token.tokens} /></strong>
  {:else if token.type === 'em'}
    <em><MarkdownTokens tokens={token.tokens} /></em>
  {:else if token.type === 'del'}
    <del><MarkdownTokens tokens={token.tokens} /></del>
  {:else if token.type === 'underline'}
    <span class="underline"><MarkdownTokens tokens={token.tokens} /></span>
  {:else if token.type === 'sub'}
    <sub><MarkdownTokens tokens={token.tokens} /></sub>
  {:else if token.type === 'sup'}
    <sup><MarkdownTokens tokens={token.tokens} /></sup>
  {:else if token.type === 'spoiler'}
    <span
      data-spoiler
      data-revealed={!!revealed[i]}
      class={revealed[i]
        ? 'rounded-sm bg-on-surface/8'
        : 'cursor-pointer select-none rounded-sm bg-on-surface/15 text-transparent'}
      role="button"
      tabindex="0"
      onclick={(e) => { e.stopPropagation(); revealed[i] = true; }}
      onkeydown={(e) => { if (e.key === 'Enter') revealed[i] = true; }}
    ><MarkdownTokens tokens={token.tokens} /></span>
  {:else if token.type === 'codespan'}
    <code class="rounded bg-on-surface/8 px-1 font-mono text-[0.9em]">{token.text}</code>
  {:else if token.type === 'code'}
    <pre class="my-1 overflow-x-auto rounded-lg bg-on-surface/8 p-2 font-mono text-[0.85em]"><code>{token.text}</code></pre>
  {:else if token.type === 'link'}
    <MessageLink href={token.href}>
      {#snippet children()}<MarkdownTokens tokens={token.tokens} />{/snippet}
    </MessageLink>
  {:else if token.type === 'heading'}
    <p class={token.depth <= 3 ? 'my-0 text-[1.1em] font-bold' : 'my-0 font-bold'}>
      <MarkdownTokens tokens={token.tokens} />
    </p>
  {:else if token.type === 'list'}
    {#if token.ordered}
      <ol class="my-0 list-decimal ps-5" start={token.start || 1}>
        {#each token.items as item}<li><MarkdownTokens tokens={item.tokens} /></li>{/each}
      </ol>
    {:else}
      <ul class="my-0 list-disc ps-5">
        {#each token.items as item}<li><MarkdownTokens tokens={item.tokens} /></li>{/each}
      </ul>
    {/if}
  {:else if token.type === 'blockquote'}
    <blockquote class="my-1 border-s-2 border-current/40 ps-2 opacity-90">
      <MarkdownTokens tokens={token.tokens} />
    </blockquote>
  {:else if token.type === 'expandableQuote'}
    <details class="my-1 border-s-2 border-current/40 ps-2">
      <summary class="cursor-pointer select-none opacity-70">…</summary>
      <MarkdownTokens tokens={token.tokens} />
    </details>
  {:else if token.type === 'table'}
    <div class="my-1 max-w-full overflow-x-auto">
      <table class="border-collapse text-[0.95em]">
        <thead>
          <tr>
            {#each token.header as cell}
              <th class="border border-current/20 px-2 py-1 text-start font-semibold">
                <MarkdownTokens tokens={cell.tokens} />
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each token.rows as row}
            <tr>
              {#each row as cell}
                <td class="border border-current/20 px-2 py-1"><MarkdownTokens tokens={cell.tokens} /></td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if token.type === 'hr'}
    <hr class="my-1.5 border-current/20" />
  {:else if token.type === 'br'}
    <br />
  {:else if token.type === 'space'}
    {''}
  {:else if token.type === 'footnoteRef'}
    <sup class="opacity-80">[{token.label}]</sup>
  {:else if token.type === 'footnoteDef'}
    <p class="my-0 text-[0.85em] opacity-80">[{token.label}]: <MarkdownTokens tokens={token.tokens} /></p>
  {:else if token.type === 'escape'}
    {token.text}
  {:else}
    {token.raw ?? token.text ?? ''}
  {/if}
{/each}
