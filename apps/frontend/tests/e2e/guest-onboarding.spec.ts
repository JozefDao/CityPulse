import { expect, test } from '@playwright/test';

test('guest can browse landing and dashboard onboarding states', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Weather, air quality, and city insights in one clean workflow.')).toBeVisible();
  await page.getByRole('link', { name: 'Open dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Guest mode')).toBeVisible();
  await expect(page.getByText('Search a city on the right and press')).toBeVisible();
  await expect(page.getByText('Pick a city to begin')).toBeVisible();
});
