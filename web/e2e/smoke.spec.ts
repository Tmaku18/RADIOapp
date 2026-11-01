import { expect, test } from '@playwright/test';

test('the public site answers and names the station', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/networx/i);
});
