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

function getAdminCredentials() {
  const backendEnv = loadEnvFromFile(path.resolve(__dirname, '../../../backend/.env'));
  const firstAdminEmail = String(backendEnv.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0];

  return {
    backendEnv,
    adminEmail: firstAdminEmail || process.env.E2E_ADMIN_EMAIL,
    adminPassword: process.env.E2E_ADMIN_PASSWORD || backendEnv.E2E_ADMIN_PASSWORD,
  };
}

module.exports = {
  getAdminCredentials,
  loadEnvFromFile,
};

