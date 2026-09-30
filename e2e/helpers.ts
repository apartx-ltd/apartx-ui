import { expect, type Page } from '@playwright/test';

// SvelteKit SSRs the trigger button, so Playwright can click it BEFORE hydration
// attaches the Svelte onclick handler — that first click is lost. Retry the open
// until the overlay actually appears (absorbs the hydration race deterministically).
export async function openOverlay(page: Page, triggerTestId: string, bodyTestId: string) {
  const body = page.getByTestId(bodyTestId);
  await expect(async () => {
    await page.getByTestId(triggerTestId).click();
    await expect(body).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  return body;
}
