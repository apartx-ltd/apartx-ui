<script lang="ts">
  // @ts-nocheck — компоненты кита без типов пропов требуют `class` и прочее у каждого тега;
  // фикстура теста их не передаёт.
  import { untrack } from 'svelte';
  import Page from '../Page.svelte';
  import Header from '../Header.svelte';
  import Toolbar from '../Toolbar.svelte';
  import Footer from '../Footer.svelte';
  import BackButton from '../BackButton.svelte';
  import Dialog from '../../overlays/Dialog.svelte';
  import { setHostChrome, setBackVisibility } from '../../../navigation/context';

  let {
    chrome = false,
    header = false,
    showTop = true,
    second = false,
    dialog = false,
    nested = false,
    footer = false,
    backVisible = undefined,
    backHref = undefined,
    outsidePage = false,
  }: {
    chrome?: boolean;
    header?: boolean;
    showTop?: boolean;
    second?: boolean;
    dialog?: boolean;
    nested?: boolean;
    footer?: boolean;
    backVisible?: boolean;
    backHref?: string;
    outsidePage?: boolean;
  } = $props();

  let top = $state(untrack(() => showTop));
  export function setShowTop(v: boolean) {
    top = v;
  }

  if (untrack(() => chrome)) setHostChrome({ end: hostX });
  if (untrack(() => backVisible) !== undefined) setBackVisibility(() => backVisible as boolean);
</script>

{#snippet hostX()}<button data-testid="host-x">x</button>{/snippet}
{#snippet ownEnd()}<button data-testid="own-end">own</button>{/snippet}
{#snippet topStart()}{@render back('top')}{/snippet}
{#snippet back(id: string)}<BackButton data-testid={`back-${id}`} href={backHref} />{/snippet}

<Page data-testid="page">
  {#if top}
    {#if header}
      <Header>
        <Toolbar data-testid="top" start={topStart} end={ownEnd}>top</Toolbar>
      </Header>
    {:else}
      <Toolbar data-testid="top" start={topStart} end={ownEnd}>top</Toolbar>
    {/if}
  {/if}
  {#if second}
    <Toolbar data-testid="second">{@render back('second')}second</Toolbar>
  {/if}
  {#if dialog}
    <Dialog open={true} title="d" respectBack={false}>
      <Toolbar data-testid="dialog">{@render back('dialog')}dialog</Toolbar>
      {#if nested}
        <Page>
          <Toolbar data-testid="nested">{@render back('nested')}nested</Toolbar>
        </Page>
      {/if}
    </Dialog>
  {/if}
  {#if footer}
    <Footer><Toolbar data-testid="footer">{@render back('footer')}footer</Toolbar></Footer>
  {/if}
</Page>
{#if outsidePage}
  <Toolbar data-testid="outside">{@render back('outside')}outside</Toolbar>
{/if}
