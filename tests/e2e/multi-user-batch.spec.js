const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value.replace(/^"(.*)"$/, '$1');
  }

  return env;
}

const backendEnv = loadEnvFromFile(path.resolve(__dirname, '../../backend/.env'));
const firstAdminEmail = String(backendEnv.ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)[0];

const adminEmail = firstAdminEmail || process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || backendEnv.E2E_ADMIN_PASSWORD;

async function login(page, email, password) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: "Bard's Journal" }).first()).toBeVisible();
  await expect(page.locator('.user-menu > summary')).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
}

async function register(page, email, password) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.user-menu > summary')).toBeVisible();
}

test.describe.serial('Multi-user campaign batch journaling', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const campaignName = `E2E Batch Campaign ${suffix}`;
  const users = [
    {
      email: `e2e.batch.one.${suffix}@example.com`,
      password: 'StrongPass123!',
      note: `Batch note one ${suffix}`,
    },
    {
      email: `e2e.batch.two.${suffix}@example.com`,
      password: 'StrongPass123!',
      note: `Batch note two ${suffix}`,
    },
    {
      email: `e2e.batch.three.${suffix}@example.com`,
      password: 'StrongPass123!',
      note: `Batch note three ${suffix}`,
    },
  ];

  test('admin creates campaign and multiple users add notes to shared campaign', async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page.getByPlaceholder('Campaign name').fill(campaignName);
    await page.getByRole('button', { name: 'Create' }).click();

    const campaignCard = page.locator('.campaign-item', { hasText: campaignName }).first();
    await expect(campaignCard).toBeVisible();
    const joinText = await campaignCard.locator('span').first().innerText();
    const match = joinText.match(/Join code:\s*(\S+)/i);
    expect(match).toBeTruthy();
    const joinCode = match[1];
    await logout(page);

    for (const user of users) {
      await register(page, user.email, user.password);
      await page.getByRole('button', { name: 'Campaigns' }).click();
      await page.getByPlaceholder('Join code').fill(joinCode);
      await page.getByRole('button', { name: 'Join' }).click();
      await expect(page.locator('.campaign-item', { hasText: campaignName }).first()).toBeVisible();

      await page
        .locator('.campaign-item', { hasText: campaignName })
        .first()
        .getByRole('button', { name: 'Load campaign journal' })
        .click();

      const editor = page.locator('.editor .ql-editor').first();
      await editor.click();
      await editor.fill(user.note);
      await page
        .locator('.journal-chat-composer form')
        .evaluate((form) => form.requestSubmit());

      await expect(page.locator('.note', { hasText: user.note }).first()).toBeVisible();
      await logout(page);
    }

    await login(page, adminEmail, adminPassword);
    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page
      .locator('.campaign-item', { hasText: campaignName })
      .first()
      .getByRole('button', { name: 'Load campaign journal' })
      .click();
    await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();

    for (const user of users) {
      await expect(page.locator('.note', { hasText: user.note }).first()).toBeVisible();
      await expect(page.locator('.note', { hasText: user.email }).first()).toBeVisible();
    }
  });
});
