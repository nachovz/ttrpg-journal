async function submitJournalEntry(page, editor, entry) {
  await editor.click();
  await editor.fill(entry);
  await page.locator('.journal-chat-composer form').evaluate((form) => form.requestSubmit());
}

module.exports = {
  submitJournalEntry,
};

