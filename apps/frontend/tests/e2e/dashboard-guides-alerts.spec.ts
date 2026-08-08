import { expect, test } from '@playwright/test';
import { addCityToWatchlist, makeUser, openFirstGuide, registerUser } from './helpers';

test('user can manage watchlist, alerts, and own comments', async ({ page }) => {
  const user = makeUser('flow');
  const comment = `Clear weather note ${Date.now()}`;
  const updatedComment = `${comment} updated`;

  await registerUser(page, user);
  await addCityToWatchlist(page, 'Bratislava');

  await page.goto('/alerts');
  await page.locator('select').first().selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Create alert rule' }).click();
  await expect(page.getByText('Alert rule created.')).toBeVisible();
  await expect(page.getByText(/Active rules/i)).toBeVisible();

  await openFirstGuide(page);
  await page.getByPlaceholder('Write a comment...').fill(comment);
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText(comment)).toBeVisible();

  const ownCard = page.locator('div.rounded-lg.border').filter({ hasText: user.nickname }).filter({ hasText: comment }).first();
  await ownCard.getByRole('button', { name: 'Edit' }).click();
  await ownCard.locator('textarea').fill(updatedComment);
  await ownCard.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(updatedComment)).toBeVisible();

  const editedCard = page.locator('div.rounded-lg.border').filter({ hasText: user.nickname }).filter({ hasText: updatedComment }).first();
  await editedCard.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(updatedComment)).toHaveCount(0);
});
