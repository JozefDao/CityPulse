import { expect, test } from '@playwright/test';
import { loginUser, logoutUser, makeUser, registerUser } from './helpers';

test('register, update profile, change password, and login again', async ({ page }) => {
  const user = makeUser('profile');
  const updatedNickname = `${user.nickname.slice(0, 10)}_${Date.now().toString().slice(-4)}`;
  const newPassword = `${user.password}X`;

  await registerUser(page, user);

  await page.goto('/settings');
  await page.getByLabel('Nickname').fill(updatedNickname);
  await page.getByLabel('Bio').fill('Runner who checks weather before every city plan.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();

  await page.locator('#currentPassword').fill(user.password);
  await page.locator('#newPassword').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated successfully.')).toBeVisible();

  await logoutUser(page);
  await loginUser(page, user.email, newPassword);
  await page.goto('/settings');
  await expect(page.getByLabel('Nickname')).toHaveValue(updatedNickname);
});
