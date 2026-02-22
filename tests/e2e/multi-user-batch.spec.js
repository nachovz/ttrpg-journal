const { test, expect } = require('@playwright/test');
const { getAdminCredentials } = require('./support/env');
const { applyTemplate, loadJsonFixture } = require('./support/fixtures');
const { ensureUserAccount, login, logout } = require('./support/auth');
const { seededShuffle } = require('./support/random');
const { submitJournalEntry } = require('./support/journal');
const { backendEnv, adminEmail, adminPassword } = getAdminCredentials();

test.describe.serial('Multi-user campaign batch journaling', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const fixture = applyTemplate(loadJsonFixture('multi-user-batch.json'), { suffix });
  const campaignName = fixture.campaignName;
  const adminEntries = fixture.adminEntries;
  const users = fixture.users;

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

    const joinedUsers = new Set();
    const participantKinds = ['admin', ...users.map((user) => user.email)];

    for (let roundIndex = 0; roundIndex < 4; roundIndex += 1) {
      const roundOrder = seededShuffle(participantKinds, `${campaignName}:round:${roundIndex}`);
      for (const participantKey of roundOrder) {
        if (participantKey === 'admin') {
          await login(page, adminEmail, adminPassword);
          await page.getByRole('button', { name: 'Campaigns' }).click();
          await page
            .locator('.campaign-item', { hasText: campaignName })
            .first()
            .getByRole('button', { name: 'Load campaign journal' })
            .click();

          const adminEditor = page.locator('.editor .ql-editor').first();
          const visibilitySwitch = page.getByRole('switch').first();
          if (roundIndex === 0) {
            await expect(visibilitySwitch).toBeChecked();
          } else {
            await visibilitySwitch.uncheck();
          }

          await submitJournalEntry(page, adminEditor, adminEntries[roundIndex]);
          await expect(page.locator('.note', { hasText: adminEntries[roundIndex] }).first()).toBeVisible();
          await logout(page);
          continue;
        }

        const user = users.find((candidate) => candidate.email === participantKey);
        if (!user) continue;

        await ensureUserAccount(page, {
          email: user.email,
          password: user.password,
          username: user.username,
          characterName: user.characterName,
        });
        await page.getByRole('button', { name: 'Campaigns' }).click();

        if (!joinedUsers.has(user.email)) {
          await page.getByPlaceholder('Join code').fill(joinCode);
          await page.getByRole('button', { name: 'Join' }).click();
          await expect(page.locator('.campaign-item', { hasText: campaignName }).first()).toBeVisible();
          joinedUsers.add(user.email);
        }

        await page
          .locator('.campaign-item', { hasText: campaignName })
          .first()
          .getByRole('button', { name: 'Load campaign journal' })
          .click();

        const editor = page.locator('.editor .ql-editor').first();
        const entry = user.entries[roundIndex];
        await submitJournalEntry(page, editor, entry);
        await expect(page.locator('.note', { hasText: entry }).first()).toBeVisible();
        await logout(page);
      }
    }

    await login(page, adminEmail, adminPassword);
    await page.getByRole('button', { name: 'Campaigns' }).click();
    await page
      .locator('.campaign-item', { hasText: campaignName })
      .first()
      .getByRole('button', { name: 'Load campaign journal' })
      .click();
      await expect(page.getByRole('heading', { name: campaignName, level: 3 })).toBeVisible();

    for (const adminEntry of adminEntries) {
      await expect(page.locator('.note', { hasText: adminEntry }).first()).toBeVisible();
    }

    for (const user of users) {
      for (const entry of user.entries) {
        await expect(page.locator('.note', { hasText: entry }).first()).toBeVisible();
      }
      await expect(page.locator('.note', { hasText: user.characterName }).first()).toBeVisible();
    }
  });
});
