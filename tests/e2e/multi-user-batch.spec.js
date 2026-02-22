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

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function seededShuffle(items, seedKey) {
  const copy = [...items];
  let seed = hashString(seedKey) || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

test.describe.serial('Multi-user campaign batch journaling', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_PASSWORD (and optionally E2E_ADMIN_EMAIL). ADMIN_EMAILS from backend/.env is used as fallback email.'
  );

  const suffix = Date.now().toString(36);
  const campaignName = `Siege of Duskhollow - Shared Journal ${suffix}`;
  const adminEntries = [
    `DM setup note (${suffix}): Baroness Elira will offer a false treaty at dusk to buy time for the necromancer's ritual.`,
    `DM battlefield cue (${suffix}): Trigger the bell tower collapse only after the party secures civilians from the market square.`,
    `DM continuity note (${suffix}): Captain Veyn lost his left gauntlet in session 3; keep that detail in later scenes.`,
    `DM mystery hook (${suffix}): The pale rider is bound to the ruined abbey crypt and cannot cross consecrated ground.`,
  ];
  const users = [
    {
      email: 'lina.stormrider.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Lina Stormrider',
      characterName: 'Lina Stormrider',
      entries: [
        `I trailed the cloaked courier from the East Gate to the candle-maker's loft and heard him mention "the third seal." (${suffix})`,
        `The innkeeper keeps a second ledger beneath the ale casks; several entries are marked with the same raven sigil. (${suffix})`,
        `Used message cantrip to coordinate with Kael from the rooftop while the patrol searched the square below. (${suffix})`,
        `I hid the wax impression of the magistrate key in my boot heel until we can compare it to the archive lock. (${suffix})`,
      ],
    },
    {
      email: 'borin.emberforge.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Borin Emberforge',
      characterName: 'Borin Emberforge',
      entries: [
        `Reset the gate chains and patched a cracked hinge with spare rivets from the smithy scrap bin. (${suffix})`,
        `Counted only nine serviceable shields in the barracks; the rest need fresh leather straps before dawn. (${suffix})`,
        `The old dwarven drainage grates under the granary still open if you strike the latch plate from below. (${suffix})`,
        `Forged iron wedges for the portcullis so it cannot be dropped on us if the cult retakes the gatehouse. (${suffix})`,
      ],
    },
    {
      email: 'kael.nightbrook.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Kael Nightbrook',
      characterName: 'Kael Nightbrook',
      entries: [
        `Spotted ballista crews on the eastern wall and marked a hidden postern gate behind the ivy-covered shrine. (${suffix})`,
        `Mapped the guard rotation near the north tower; the changeover leaves a short blind window after second bell. (${suffix})`,
        `The stablemaster is willing to hide our mounts if we get his daughter through the sewer tunnel before dawn. (${suffix})`,
        `Found fresh boot prints in the chapel crypt stairs, likely scouts using the old ossuary route into Duskhollow. (${suffix})`,
      ],
    },
    {
      email: 'seraphina.valewind.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Seraphina Valewind',
      characterName: 'Seraphina Valewind',
      entries: [
        `High Priest Orlen agreed to bless the vials of holy water if we return the reliquary before dawn. (${suffix})`,
        `The shrine wards flicker when the moon passes the bell tower; divine magic feels stronger near the eastern transept. (${suffix})`,
        `Brother Halven remembers a hidden reliquary chamber behind the altar fresco but fears the abbot's ghost still guards it. (${suffix})`,
        `Prepared healing draughts and sanctified bandages for the militia line holding the market square. (${suffix})`,
      ],
    },
    {
      email: `torvin.ironroot+${suffix}@example.com`,
      password: 'StrongPass123!',
      username: 'Torvin Ironroot',
      characterName: 'Torvin Ironroot',
      entries: [
        `Reinforced the south barricade with wagon axles and counted enough oil for one more wave. (${suffix})`,
        `Set caltrops in the alley behind the cooper's shop and braced the shutters with iron spikes. (${suffix})`,
        `The smithy bellows can be rigged to smoke out the tunnel mouth if the goblins push in again. (${suffix})`,
        `Sharpened pikes for the night watch and marked the weakest plank in the west palisade for replacement. (${suffix})`,
      ],
    },
    {
      email: 'mira.thornwhisper.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Mira Thornwhisper',
      characterName: 'Mira Thornwhisper',
      entries: [
        `Tracked worg spoor along the riverbank and found a hidden campfire ring under the alder roots. (${suffix})`,
        `The ravens nested on the gatehouse react to infernal whispers before anyone else notices them. (${suffix})`,
        `Collected black moss from the cistern wall for antidote brewing; likely useful if the cult uses poison darts again. (${suffix})`,
        `Marked a quiet rooftop path from the apothecary to the watchtower for ranged support during the siege. (${suffix})`,
      ],
    },
    {
      email: 'aldric.mournvale.playtest@example.com',
      password: 'StrongPass123!',
      username: 'Aldric Mournvale',
      characterName: 'Aldric Mournvale',
      entries: [
        `The town charter names an old escape gate beneath the magistrate archives; the key seal matches the silver signet. (${suffix})`,
        `Questioned three refugees and all mentioned a pale rider circling the walls before each assault. (${suffix})`,
        `Copied the chapel ledger entries naming donors tied to the Crimson Banner mercenaries. (${suffix})`,
        `Drafted a truce message in formal court hand in case we need to stall for one more night. (${suffix})`,
      ],
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

          await editorEntry(page, adminEditor, adminEntries[roundIndex]);
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
        await editorEntry(page, editor, entry);
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

async function editorEntry(page, editor, entry) {
  await editor.click();
  await editor.fill(entry);
  await page
    .locator('.journal-chat-composer form')
    .evaluate((form) => form.requestSubmit());
}
