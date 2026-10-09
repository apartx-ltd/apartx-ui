<script lang="ts">
  import { Page, Header, Footer, Toolbar, Content, Title } from '$lib/ui/structure';
  import { Dialog, Drawer, BottomSheet } from '$lib/ui/overlays';
  import { Button, Fab, BottomNav } from '$lib/ui/display';

  // Стенд правила «инсет забирает контейнер у края экрана» (AGENTS.md → «Safe-area»).
  // e2e/safe-area.spec.ts задаёт --safe-area-inset-top/bottom на <html>, как кордова, и
  // сверяет, кто отступил. Контейнеры стоят в рамках посреди страницы — правило на CSS,
  // от положения на экране оно не зависит.
  let rawOpen = $state(false);
  let p0Open = $state(false);
  let edgeOpen = $state(false);
  let drawerOpen = $state(false);
  let sheetOpen = $state(false);
</script>

<h1 class="text-headline-md mb-6">Safe area</h1>

<!-- Fab привязан к вьюпорту: поднимается на корневую копию нижнего инсета. -->
<Fab data-testid="sa-fab"><Button variant="fab" aria-label="Add">+</Button></Fab>

<div class="mb-6 flex flex-wrap gap-3">
  <Button data-testid="open-sa-dialog-raw" onclick={() => (rawOpen = true)}>Dialog: raw header</Button>
  <Button data-testid="open-sa-dialog-p0" variant="tonal" onclick={() => (p0Open = true)}>Dialog: host p-0</Button>
  <Button data-testid="open-sa-dialog-edge" variant="tonal" onclick={() => (edgeOpen = true)}>Dialog: edgeToEdge</Button>
  <Button data-testid="open-sa-sheet" variant="tonal" onclick={() => (sheetOpen = true)}>BottomSheet</Button>
</div>

<div class="grid gap-4 sm:grid-cols-2">
  <div class="flex h-40 border border-outline-variant">
    <Page data-testid="sa-page-header">
      <Header data-testid="sa-header">
        <Toolbar><Title>Page with header</Title></Toolbar>
      </Header>
      <Content padding>The page reserves the inset; the header sees zero.</Content>
    </Page>
  </div>

  <div class="flex h-40 border border-outline-variant">
    <Page data-testid="sa-page-bare">
      <Content padding>
        <p data-testid="sa-bare-text">Page without a header.</p>
        <Button data-testid="open-sa-drawer" variant="tonal" onclick={() => (drawerOpen = true)}>Open Drawer</Button>
      </Content>
      <!-- Drawer объявлен ВНУТРИ Page: он не портируется и наследует обнулённый инсет,
           поэтому панель обязана отступать по корневой копии. -->
      <Drawer bind:open={drawerOpen} side="left" data-testid="sa-drawer">
        <Header data-testid="sa-drawer-header">
          <Toolbar><Title>Drawer</Title></Toolbar>
        </Header>
        <Content padding>Drawer body.</Content>
      </Drawer>
    </Page>
  </div>

  <div class="flex h-40 border border-outline-variant">
    <Page data-testid="sa-page-outer">
      <Header><Toolbar><Title>Outer page</Title></Toolbar></Header>
      <Content>
        <Page data-testid="sa-page-inner">
          <Content padding>Nested page.</Content>
        </Page>
      </Content>
    </Page>
  </div>

  <div class="flex h-40 flex-col border border-outline-variant">
    <Header data-testid="sa-header-standalone">
      <Toolbar><Title>Header without Page</Title></Toolbar>
    </Header>
  </div>

  <div class="flex h-40 border border-outline-variant">
    <Page data-testid="sa-page-p0" class="p-0">
      <Content padding>Host class p-0.</Content>
    </Page>
  </div>

  <!-- Низ: Page забирает и нижний инсет; Footer внутри видит 0 и докрашивает полоску под
       собой своим фоном (::after) — иначе под ним был бы шов цвета страницы. -->
  <div class="flex h-48 border border-outline-variant">
    <Page data-testid="sa-page-footer">
      <Content padding>Page with footer.</Content>
      <Footer data-testid="sa-footer">
        <div class="p-3"><Button class="w-full">Action</Button></div>
      </Footer>
    </Page>
  </div>

  <!-- Оболочка с нижней навигацией — сама Page: инсеты забирает она, вложенная страница и
       навигация в Footer видят ноль. -->
  <div class="flex h-56 border border-outline-variant">
    <Page data-testid="sa-shell">
      <Page data-testid="sa-page-navhost">
        <Content padding>Page above a bottom nav.</Content>
      </Page>
      <Footer>
        <BottomNav
          data-testid="sa-nav"
          class="static"
          active="home"
          items={[
            { value: 'home', label: 'Home' },
            { value: 'settings', label: 'Settings' },
          ]}
        />
      </Footer>
    </Page>
  </div>
</div>

<!-- Своя шапка сырым div, без Toolbar/Header. -->
<Dialog bind:open={rawOpen} fullScreen showCloseButton={false} data-testid="sa-dialog-raw">
  {#snippet header()}
    <div class="flex items-center gap-2 px-4 py-2">
      <Button data-testid="sa-dialog-raw-close" variant="text" onclick={() => (rawOpen = false)}>Close</Button>
    </div>
  {/snippet}
  <p class="text-body-lg text-on-surface-variant">Raw header dialog.</p>
</Dialog>

<!-- Хост зануляет отступы панели классом. -->
<Dialog bind:open={p0Open} fullScreen title="Host p-0" contentClass="p-0" data-testid="sa-dialog-p0">
  <p class="text-body-lg text-on-surface-variant">Body.</p>
  {#snippet footer()}
    <div data-testid="sa-dialog-p0-footer" class="border-t border-outline-variant p-4">
      <Button class="w-full" onclick={() => (p0Open = false)}>Done</Button>
    </div>
  {/snippet}
</Dialog>

<!-- edgeToEdge: панель сверху не отступает — содержимое красит область под статус-баром
     своим фоном и отступ контента делает само. -->
<Dialog bind:open={edgeOpen} fullScreen edgeToEdge showCloseButton={false} layout="flush" data-testid="sa-dialog-edge">
  <div data-testid="sa-dialog-edge-probe" class="bg-primary-container pt-[var(--safe-area-inset-top,0px)]">
    <Button data-testid="sa-dialog-edge-close" variant="text" onclick={() => (edgeOpen = false)}>Close</Button>
  </div>
</Dialog>

<!-- BottomSheet портируется в body и отступает снизу по корневой копии инсета: последняя
     строка контента на полном снапе стоит над home indicator. -->
<BottomSheet bind:open={sheetOpen} snapPoints={[1]}>
  <div class="flex h-full flex-col justify-end p-4">
    <p data-testid="sa-sheet-last">Last row of the sheet.</p>
  </div>
</BottomSheet>
