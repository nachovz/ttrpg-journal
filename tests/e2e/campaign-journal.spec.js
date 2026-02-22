const { test, expect } = require('@playwright/test');
const { getAdminCredentials } = require('./support/env');
const { applyTemplate, loadJsonFixture } = require('./support/fixtures');
const { ensureUserAccount, loginAndAssertNoFetchError, logoutWithPasswordVisible } = require('./support/auth');
const { backendEnv, adminEmail, adminPassword } = getAdminCredentials();

test.describe.serial('Campaign journaling flow', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const fixture = applyTemplate(loadJsonFixture('campaign-journal.json'), { suffix });
  const campaignName = fixture.campaignName;
  const userEmail = fixture.users.primary.email;
  const userPassword = fixture.users.primary.password;
  const userUsername = fixture.users.primary.username;
  const userCharacterName = fixture.users.primary.characterName;
  const secondUserEmail = fixture.users.secondary.email;
  const secondUserPassword = fixture.users.secondary.password;
  const secondUserUsername = fixture.users.secondary.username;
  const secondUserCharacterName = fixture.users.secondary.characterName;
  const userPrivateNoteText = fixture.notes.userPrivate;
  const adminPrivateNoteText = fixture.notes.adminPrivate;
  const adminPublicNoteText = fixture.notes.adminPublic;

  let joinCode = '';

  test('admin creates campaign and obtains join code', async ({ page }) => {
    await loginAndAssertNoFetchError(page, adminEmail, adminPassword);

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

    await logoutWithPasswordVisible(page);
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

    await logoutWithPasswordVisible(page);
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

    await logoutWithPasswordVisible(page);
  });

  test('admin can view journal entry grouped by campaign in read-only mode', async ({ page }) => {
    await loginAndAssertNoFetchError(page, adminEmail, adminPassword);

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
