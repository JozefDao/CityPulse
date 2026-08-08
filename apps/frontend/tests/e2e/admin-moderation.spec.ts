import { expect, test } from '@playwright/test';
import { loginUser, logoutUser, makeUser, openFirstGuide, registerUser } from './helpers';

const ADMIN_EMAIL = 'admin@citypulse.dev';
const ADMIN_PASSWORD = 'admin12345!';

test('admin can review a user-reported comment', async ({ page }) => {
  const author = makeUser('author');
  const reporter = makeUser('report');
  const commentText = `Clear local note ${Date.now()}`;

  await registerUser(page, author);
  await openFirstGuide(page);
  await page.getByPlaceholder('Write a comment...').fill(commentText);
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText(commentText)).toBeVisible();

  await logoutUser(page);

  await registerUser(page, reporter);
  await openFirstGuide(page);
  const commentCard = page.locator('div.rounded-lg.border').filter({ hasText: author.nickname }).filter({ hasText: commentText }).first();
  await expect(commentCard).toBeVisible();
  await commentCard.getByRole('button', { name: 'Report' }).click();
  const hiddenCommentCard = page.locator('div.rounded-lg.border').filter({ hasText: author.nickname }).first();
  await expect(hiddenCommentCard.getByText('Comment hidden by moderation.')).toBeVisible();

  await logoutUser(page);
  await loginUser(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin/moderation');

  const moderationText = page.getByText(commentText);
  await expect(moderationText).toBeVisible();
  const moderationItem = moderationText.locator('xpath=ancestor::div[.//button[contains(., "Approve (unflag)")]][1]');
  await moderationItem.getByRole('button', { name: 'Approve (unflag)' }).click();
  await expect(page.getByText(commentText)).toHaveCount(0);
});
