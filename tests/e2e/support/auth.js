const { expect } = require('@playwright/test');

async function login(page, email, password) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: "Bard's Journal" }).first()).toBeVisible();
  await expect(page.locator('.user-menu > summary')).toBeVisible();
}

async function loginAndAssertNoFetchError(page, email, password) {
  await login(page, email, password);
  await expect(page.getByText('Failed to fetch')).not.toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
}

async function logoutWithPasswordVisible(page) {
  await logout(page);
  await expect(page.getByLabel('Password')).toBeVisible();
}

async function saveProfile(page, { username, characterName }) {
  await expect(page.locator('.user-menu > summary')).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Character Name').fill(characterName);
  await page.getByRole('button', { name: 'Save profile' }).click();
}

async function ensureUserAccount(page, { email, password, username, characterName }) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();

  const userMenu = page.locator('.user-menu > summary');
  if (await userMenu.isVisible().catch(() => false)) {
    await saveProfile(page, { username, characterName });
    return;
  }

  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  try {
    await expect(userMenu).toBeVisible({ timeout: 3000 });
  } catch {
    await login(page, email, password);
  }
  await saveProfile(page, { username, characterName });
}

module.exports = {
  ensureUserAccount,
  login,
  loginAndAssertNoFetchError,
  logout,
  logoutWithPasswordVisible,
  saveProfile,
};

