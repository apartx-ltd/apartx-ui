import { test, expect, type Page } from '@playwright/test';

// Гард ухода на SvelteKit-адаптере (router/guard). Браузерный адаптер (Meteor-хосты) этой
// демкой не покрыт — его держат юниты кита и e2e кабинета (property-info-unsaved-guard).

// SvelteKit SSR-ит поле: ввод до гидрации не доходит до $state — ретраим, пока гард не
// увидит черновик (тот же приём, что в host-navigation.spec.ts).
async function makeDirty(page: Page) {
  await page.goto('/router-demo');
  const draft = page.getByTestId('leave-guard-draft');
  await expect(async () => {
    await draft.fill('');
    await draft.fill('draft');
    await expect(draft).toHaveValue('draft', { timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

// Confirm-панель — ConfirmDialog, role="alertdialog".
const guardDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Unsaved changes' });

test('ссылка при dirty: «Остаться» — URL прежний; «Уйти» — навигация', async ({ page }) => {
  await makeDirty(page);
  await page.getByRole('link', { name: 'Alpha →' }).click();
  const dialog = guardDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/router-demo$/);
  await expect(page.getByTestId('leave-guard-stays')).toHaveText('1');

  await page.getByRole('link', { name: 'Alpha →' }).click();
  await guardDialog(page).getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/router-demo\/detail\?id=alpha/);
});

test('back браузера при dirty: «Остаться» — страница та же и back по-прежнему жив; «Уйти» — уход за одно нажатие', async ({ page }) => {
  // Детальная → список SPA-ссылкой: «назад» со списка — popstate внутри документа.
  await page.goto('/router-demo/detail?id=alpha');
  await expect(async () => {
    await page.getByTestId('detail-to-list').click();
    await expect(page).toHaveURL(/\/router-demo$/, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  const draft = page.getByTestId('leave-guard-draft');
  await draft.fill('draft');
  await expect(draft).toHaveValue('draft');
  await page.goBack();
  const dialog = guardDialog(page);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/router-demo$/);
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(500); // дать осесть служебным траверсам
  await expect(page).toHaveURL(/\/router-demo$/);
  await expect(page.getByTestId('leave-guard-draft')).toHaveValue('draft');

  // Back не помечен skip-on-back: следующий back снова спрашивает, а не проваливается мимо.
  await page.goBack();
  await expect(guardDialog(page)).toBeVisible();
  await guardDialog(page).getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/router-demo\/detail\?id=alpha/);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/router-demo\/detail\?id=alpha/); // устояло, не откатилось
});

test('без правок навигация не спрашивает', async ({ page }) => {
  await page.goto('/router-demo');
  await page.getByRole('link', { name: 'Alpha →' }).click();
  await expect(page).toHaveURL(/\/router-demo\/detail\?id=alpha/);
  await expect(guardDialog(page)).toHaveCount(0);
});
