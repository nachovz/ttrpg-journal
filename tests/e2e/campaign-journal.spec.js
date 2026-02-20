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
  await expect(page.getByText('Failed to fetch')).not.toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
}

test.describe.serial('Campaign journaling flow', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const campaignName = `E2E Campaign ${suffix}`;
  const userEmail = `e2e.user.${suffix}@example.com`;
  const userPassword = 'StrongPass123!';
  const noteText = `E2E note ${suffix}`;
  const updatedNoteText = `E2E updated note ${suffix}`;

  let joinCode = '';

  test('admin creates campaign and obtains join code', async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await expect(page.getByText('Role: admin')).toBeVisible();

    await page.getByRole('button', { name: 'Campaigns' }).click();

    await page.getByPlaceholder('Campaign name').fill(campaignName);
    await page.getByRole('button', { name: 'Create' }).click();

    const campaignCard = page.locator('.campaign-item', { hasText: campaignName }).first();
    await expect(campaignCard).toBeVisible();

    const joinText = await campaignCard.locator('span').first().innerText();
    const match = joinText.match(/Join code:\s*(\S+)/i);
    expect(match).toBeTruthy();
    joinCode = match[1];

    await logout(page);
  });

  test('new user registers, joins campaign and creates campaign note', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill(userPassword);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Role: user')).toBeVisible();

    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page.getByPlaceholder('Join code').fill(joinCode);
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.locator('.campaign-item', { hasText: campaignName }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Journal' }).click();
    await page.getByLabel('Campaign').selectOption({ label: campaignName });

    const editor = page.locator('.editor .ql-editor').first();
    await editor.click();
    await editor.fill(noteText);

    await page
      .locator('section.card', { has: page.getByRole('heading', { name: 'New Entry' }) })
      .locator('form')
      .evaluate((form) => form.requestSubmit());

    await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();
    await expect(page.locator('.note', { hasText: noteText }).first()).toBeVisible();

    await logout(page);
  });

  test('admin can edit a journal entry grouped by campaign', async ({ page }) => {
    await login(page, adminEmail, adminPassword);

    await page.getByRole('button', { name: 'Journal' }).click();
    await page.getByLabel('Campaign').selectOption({ label: campaignName });
    await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();

    const noteCard = page.locator('.note', { hasText: noteText }).first();
    await expect(noteCard).toBeVisible();

    await noteCard.getByRole('button', { name: 'Edit entry' }).click();

    const editingCard = page.locator('.note').filter({ has: page.getByRole('button', { name: 'Save changes' }) }).first();
    const editEditor = editingCard.locator('.editor .ql-editor').first();
    await editEditor.click();
    await editEditor.fill(updatedNoteText);

    await editingCard.getByRole('button', { name: 'Save changes' }).click({ force: true });

    await expect(page.locator('.note', { hasText: updatedNoteText }).first()).toBeVisible();
  });
});
