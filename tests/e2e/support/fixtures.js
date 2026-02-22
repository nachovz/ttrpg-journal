const fs = require('node:fs');
const path = require('node:path');

function loadJsonFixture(fileName) {
  const filePath = path.resolve(__dirname, '../fixtures', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function applyTemplate(value, variables) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? ''));
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, variables));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, applyTemplate(nestedValue, variables)])
    );
  }
  return value;
}

module.exports = {
  applyTemplate,
  loadJsonFixture,
};

