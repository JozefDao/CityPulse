import { expect, test } from '@playwright/test';
import { logoutUser, makeUser, registerUser } from './helpers';

test('user can create an article draft, publish it, and save it to favorites', async ({ page }) => {
  const user = makeUser('author');
  const articleTitle = `Dry sky memo ${Date.now()}`;
  const articleSummary = 'Low wind map.';
  const articleBody = '# Plan\n\nDry air. Low wind.';

  await registerUser(page, user);
  await page.goto('/my-articles');
  await expect(page.getByRole('heading', { name: 'My articles' })).toBeVisible();

  await page.locator('#article-title').fill(articleTitle);
  await page.locator('#article-summary').fill(articleSummary);
  await page.locator('#article-markdown').fill(articleBody);
  await page.getByRole('button', { name: 'Create draft' }).click();

  const articleCard = page.locator('div.rounded-lg.border.border-border.p-3').filter({ hasText: articleTitle }).first();
  await expect(articleCard.getByText(articleTitle)).toBeVisible();
  await expect(articleCard.getByText('DRAFT', { exact: true })).toBeVisible();

  await articleCard.getByRole('button', { name: 'Publish article' }).click();
  await expect(articleCard.getByText('PUBLISHED')).toBeVisible();

  await page.goto('/guides');
  await page.getByRole('link', { name: new RegExp(articleTitle) }).click();
  await expect(page.getByRole('heading', { name: articleTitle })).toBeVisible();

  const saveButton = page.getByRole('button', { name: /save/i }).first();
  await saveButton.click();
  await expect(page.getByRole('button', { name: /saved/i }).first()).toBeVisible();

  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Favorite articles' })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(articleTitle) })).toBeVisible();

  await logoutUser(page);
});
