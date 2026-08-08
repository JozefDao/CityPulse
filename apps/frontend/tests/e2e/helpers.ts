import { expect, type Page } from '@playwright/test';

export type TestUser = {
  email: string;
  nickname: string;
  password: string;
};

export function makeUser(prefix: string): TestUser {
  const token = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `${token}@example.com`,
    nickname: token.slice(0, 20),
    password: `CityPulse!${token.slice(-6)}`,
  };
}

export async function registerUser(page: Page, user: TestUser) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Nickname').fill(user.nickname);
  await page.locator('#register-password').fill(user.password);
  await page.locator('#register-confirm-password').fill(user.password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function logoutUser(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function addCityToWatchlist(page: Page, cityName: string) {
  await page.goto('/dashboard');
  const input = page.getByPlaceholder('Bratislava');
  await input.fill('Brati');
  await page.waitForTimeout(500);
  await input.fill(cityName);
  const result = page.locator('[id^="search-option-"]').first();
  await expect(result).toBeVisible();
  const chosenCity = ((await result.locator('p.text-sm.font-medium').textContent()) ?? cityName).trim();
  await result.getByRole('button').click();
  await expect(page.getByText(chosenCity).first()).toBeVisible();
}

export async function openFirstGuide(page: Page) {
  await page.goto('/guides');
  const firstGuide = page.locator('a[href^="/guides/"]').first();
  await expect(firstGuide).toBeVisible();
  await firstGuide.click();
  await expect(page).toHaveURL(/\/guides\//);
}
