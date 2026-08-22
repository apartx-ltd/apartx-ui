import { test, expect, type Page } from '@playwright/test';

// Overlay regression suite for the SvelteKit host wiring. Guards two things that broke
// before v0.5.0 / the demo history-adapter fix:
//   1. A Dialog opened in the demo actually CLOSES via ✕ / Escape / scrim. This only
//      works when useSvelteKitNavigation() registers the SvelteKit adapter as the active
//      history backend (setHistoryAdapter) so the singleton overlay-stack drives close.
//   2. A Select inside a Dialog does not tear the Dialog down when an option renders
//      below the dialog's bottom edge (bits-ui coordinate-based outside-click check).

// SvelteKit SSRs the trigger button, so Playwright can click it BEFORE hydration
// attaches the Svelte onclick handler — that first click is lost. Retry the open
// until the overlay actually appears (absorbs the hydration race deterministically).
async function openOverlay(page: Page, triggerTestId: string, bodyTestId: string) {
  const body = page.getByTestId(bodyTestId);
  await expect(async () => {
    await page.getByTestId(triggerTestId).click();
    await expect(body).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  return body;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/overlays');
});

test.describe('Dialog close paths', () => {
  test('closes via the ✕ button', async ({ page }) => {
    const body = await openOverlay(page, 'open-dialog', 'dialog-body');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(body).toBeHidden();
  });

  test('closes via Escape', async ({ page }) => {
    const body = await openOverlay(page, 'open-dialog', 'dialog-body');
    await page.keyboard.press('Escape');
    await expect(body).toBeHidden();
  });

  test('closes via scrim click', async ({ page }) => {
    const body = await openOverlay(page, 'open-dialog', 'dialog-body');
    // Click the top-left corner of the viewport — outside the centered dialog panel,
    // on the scrim.
    await page.mouse.click(8, 8);
    await expect(body).toBeHidden();
  });

  test('a header action button clicks without closing the dialog', async ({ page }) => {
    const body = await openOverlay(page, 'open-dialog', 'dialog-body');
    const action = page.getByTestId('dialog-action');

    // Кнопка живёт в шапке рядом с крестиком, а не в теле — порядок в DOM тоже часть
    // контракта: сначала actions, потом «Закрыть».
    await expect(action).toBeVisible();
    const order = await page.evaluate(() => {
      const a = document.querySelector('[data-testid="dialog-action"]');
      const close = document.querySelector('[aria-label="Close"]');
      if (!a || !close) return 'missing';
      return a.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING
        ? 'action-first'
        : 'close-first';
    });
    expect(order).toBe('action-first');

    await action.click();
    await expect(page.getByTestId('dialog-action-clicks')).toHaveText('1');
    await expect(body).toBeVisible();
  });

  test('closes via browser BACK (and back does not leave the app)', async ({ page }) => {
    const body = await openOverlay(page, 'open-dialog', 'dialog-body');
    // Opening pushed a synthetic history entry; a browser BACK must close the overlay
    // and stay on the same page (not navigate away).
    await page.goBack();
    await expect(body).toBeHidden();
    await expect(page).toHaveURL(/\/overlays$/);
    // The overview heading of THIS page is still there — we didn't leave.
    await expect(page.getByRole('heading', { name: 'Overlays' })).toBeVisible();
  });
});

test.describe('Select inside Dialog', () => {
  test('picking a bottom option keeps the Dialog open and applies the value', async ({ page }) => {
    const body = await openOverlay(page, 'open-select-dialog', 'select-dialog-body');

    // Open the Select — its trigger is the button inside the wrapper.
    await page.getByTestId('dialog-select').locator('button').first().click();

    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    expect(count).toBeGreaterThan(1);

    // The LAST option is the one that (with a long list) renders below the dialog's
    // bottom edge — the exact coordinate that used to be read as an outside click.
    const last = options.nth(count - 1);
    await last.scrollIntoViewIfNeeded();
    await last.click();

    // Dialog must still be here, and the value must have applied.
    await expect(body).toBeVisible();
    await expect(page.getByTestId('dialog-select-value')).toHaveText(`opt-${count}`);
  });
});
