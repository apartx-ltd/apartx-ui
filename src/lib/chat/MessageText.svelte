<script lang="ts">
  // Unified message-text renderer: mode 'markdown' → lexed tokens through
  // MarkdownTokens; mode 'plain' → always-on linkify. See the design doc
  // (apartx workspace: docs/plans/2026-08-09-chat-markdown-links).
  import { cn } from '../ui/utils/cn';
  import { lexMessage, linkifyParts } from './markdown';
  import MarkdownTokens from './MarkdownTokens.svelte';
  import MessageLink from './MessageLink.svelte';

  let { text = '', mode = 'plain', class: klass = '' }:
    { text?: string; mode?: 'markdown' | 'plain'; class?: string } = $props();

  const tokens = $derived(mode === 'markdown' ? lexMessage(text) : []);
  const parts = $derived(mode === 'plain' ? linkifyParts(text) : []);
</script>

{#if mode === 'markdown'}
  <!-- whitespace-normal deliberately overrides the bubble's whitespace-pre-wrap:
       newlines are already tokenized (breaks: true), pre-wrap would double them. -->
  <div class={cn('whitespace-normal break-words', klass)} data-testid="message-markdown">
    <MarkdownTokens {tokens} />
  </div>
{:else}
  <span class={cn('whitespace-pre-wrap break-words', klass)} data-testid="message-text">
    {#each parts as part}
      {#if part.kind === 'link'}
        <MessageLink href={part.href}>
          {#snippet children()}{part.text}{/snippet}
        </MessageLink>
      {:else if part.kind === 'br'}<br />{:else}{part.text}{/if}
    {/each}
  </span>
{/if}
