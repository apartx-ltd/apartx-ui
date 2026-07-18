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
