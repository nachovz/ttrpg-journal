const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
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

async function runAxe(page, contextName) {
  const results = await new AxeBuilder({ page }).exclude('.ql-toolbar').analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    nodes: violation.nodes.length,
  }));

  if (results.violations.length > 0) {
    console.error(`A11Y violations for ${contextName}:`);
    console.error(JSON.stringify(summary, null, 2));
  }

  expect(results.violations, `${contextName} has accessibility violations`).toEqual([]);
}

async function login(page) {
  await page.goto('/');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: "Bard's Journal" }).first()).toBeVisible();
}

test('login screen passes axe checks', async ({ page }) => {
  await page.goto('/');
  await runAxe(page, 'login screen');
});

test.describe('authenticated screens pass axe checks', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E admin credentials to run authenticated accessibility checks');

  test('journal, campaigns, and profile views', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Journal' }).click();
    await runAxe(page, 'journal view');

    await page.getByRole('button', { name: 'Campaigns' }).click();
    await runAxe(page, 'campaigns view');

    await page.locator('.user-menu > summary').click();
    await page.locator('.user-menu-panel').getByRole('button', { name: 'Profile' }).click();
    await runAxe(page, 'profile view');
  });
});
