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
  await expect(page.locator('.user-menu > summary')).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
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

test.describe.serial('Campaign journaling flow', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const campaignName = `The Shattered Crown - Session Log ${suffix}`;
  const userEmail = 'lina.stormrider.playtest@example.com';
  const userPassword = 'StrongPass123!';
  const userUsername = 'Lina Stormrider';
  const userCharacterName = 'Lina Stormrider';
  const secondUserEmail = 'borin.emberforge.playtest@example.com';
  const secondUserPassword = 'StrongPass123!';
  const secondUserUsername = 'Borin Emberforge';
  const secondUserCharacterName = 'Borin Emberforge';
  const userPrivateNoteText =
    `Private field notes (${suffix}): I suspect the innkeeper in Daggerford is a Zhentarim informant after the midnight sending stone exchange.`;
  const adminPrivateNoteText =
    `DM private note (${suffix}): The "Silver Chalice" map fragment is hidden beneath the chapel altar and tied to Sister Meriel's confession scene.`;
  const adminPublicNoteText =
    `Session recap (${suffix}): The party negotiated safe passage through the Blackfen Marsh, defeated two troll scouts, and recovered the first shard of the Shattered Crown.`;

  let joinCode = '';

  test('admin creates campaign and obtains join code', async ({ page }) => {
    await login(page, adminEmail, adminPassword);

    await page.getByRole('button', { name: 'Campaigns' }).click();

    await page.getByPlaceholder('Campaign name').fill(campaignName);
    await page.getByRole('button', { name: 'Create' }).click();

    const campaignCard = page.locator('.campaign-item', { hasText: campaignName }).first();
    await expect(campaignCard).toBeVisible();

    const joinText = await campaignCard.locator('span').first().innerText();
    const match = joinText.match(/Join code:\s*(\S+)/i);
    expect(match).toBeTruthy();
    joinCode = match[1];

    await campaignCard.getByRole('button', { name: 'Load campaign journal' }).click();

    const adminEditor = page.locator('.editor .ql-editor').first();
    const visibilitySwitch = page.getByRole('switch').first();
    await adminEditor.click();
    await adminEditor.fill(adminPrivateNoteText);
    await expect(visibilitySwitch).toBeChecked();
    await page
      .locator('.journal-chat-composer form')
      .evaluate((form) => form.requestSubmit());
    await expect(page.locator('.note', { hasText: adminPrivateNoteText }).first()).toBeVisible();

    await adminEditor.click();
    await adminEditor.fill(adminPublicNoteText);
    await visibilitySwitch.uncheck();
    await page
      .locator('.journal-chat-composer form')
      .evaluate((form) => form.requestSubmit());
    await expect(page.locator('.note', { hasText: adminPublicNoteText }).first()).toBeVisible();

    await logout(page);
  });

  test('new user registers, joins campaign and creates private note', async ({ page }) => {
    await ensureUserAccount(page, {
      email: userEmail,
      password: userPassword,
      username: userUsername,
      characterName: userCharacterName,
    });

    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page.getByPlaceholder('Join code').fill(joinCode);
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.locator('.campaign-item', { hasText: campaignName }).first()).toBeVisible();

    await page
      .locator('.campaign-item', { hasText: campaignName })
      .first()
      .getByRole('button', { name: 'Load campaign journal' })
      .click();

    await expect(page.locator('.note', { hasText: adminPublicNoteText }).first()).toBeVisible();
    await expect(
      page.locator('.note', { hasText: adminPublicNoteText }).first().getByText(/^DM$/).first()
    ).toBeVisible();
    await expect(page.locator('.note', { hasText: adminPrivateNoteText })).toHaveCount(0);

    const editor = page.locator('.editor .ql-editor').first();
    const visibilitySwitch = page.getByRole('switch').first();
    await editor.click();
    await editor.fill(userPrivateNoteText);
    await visibilitySwitch.check();

    await page
      .locator('.journal-chat-composer form')
      .evaluate((form) => form.requestSubmit());

    await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();
    await expect(page.locator('.note', { hasText: userPrivateNoteText }).first()).toBeVisible();

    await logout(page);
  });

  test('another user cannot see private entries from first user', async ({ page }) => {
    await ensureUserAccount(page, {
      email: secondUserEmail,
      password: secondUserPassword,
      username: secondUserUsername,
      characterName: secondUserCharacterName,
    });

    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page.getByPlaceholder('Join code').fill(joinCode);
    await page.getByRole('button', { name: 'Join' }).click();

    await page
      .locator('.campaign-item', { hasText: campaignName })
      .first()
      .getByRole('button', { name: 'Load campaign journal' })
      .click();

    await expect(page.locator('.note', { hasText: adminPublicNoteText }).first()).toBeVisible();
    await expect(page.locator('.note', { hasText: adminPrivateNoteText })).toHaveCount(0);
    await expect(page.locator('.note', { hasText: userPrivateNoteText })).toHaveCount(0);

    await logout(page);
  });

  test('admin can view journal entry grouped by campaign in read-only mode', async ({ page }) => {
    await login(page, adminEmail, adminPassword);

    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page
      .locator('.campaign-item', { hasText: campaignName })
      .first()
      .getByRole('button', { name: 'Load campaign journal' })
      .click();
    await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();

    await expect(page.locator('.note', { hasText: userPrivateNoteText }).first()).toBeVisible();
    const noteCard = page.locator('.note', { hasText: adminPublicNoteText }).first();
    await expect(noteCard.getByText(/^DM$/).first()).toBeVisible();
    await expect(noteCard.getByRole('button', { name: 'Edit entry' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });
});
