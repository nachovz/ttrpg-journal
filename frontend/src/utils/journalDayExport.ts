import type { Note } from '../types/entities';

function safeText(value: string) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function slugify(value: string) {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'journal-group';
}

function formatDisplayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function noteAuthorDisplay(note: Note) {
  if (note.userRole === 'admin') return 'DM';
  return note.characterName || note.username || note.userEmail || 'Unknown';
}

function htmlToPlainText(contentHtml: string) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return safeText(contentHtml.replace(/<[^>]+>/g, ' '));
  }

  const documentParser = new DOMParser().parseFromString(contentHtml || '', 'text/html');
  const text = (documentParser.body.innerText || documentParser.body.textContent || '').replace(/\n{3,}/g, '\n\n');
  return safeText(text);
}

export function buildJournalDayExportMarkdown(params: {
  campaignId: string;
  campaignName: string;
  day: string;
  groupTitle?: string;
  notes: Note[];
}) {
  const exportedAt = new Date().toISOString();
  const normalizedGroupTitle = safeText(params.groupTitle || '') || formatDisplayDate(params.day);
  const sortedNotes = [...params.notes].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const includesPrivateEntries = sortedNotes.some((note) => (note.visibility || 'public') === 'private');

  const participants = Array.from(
    new Set(
      sortedNotes.map((note) => (note.userRole === 'admin' ? 'DM (admin)' : noteAuthorDisplay(note)))
    )
  ).sort((a, b) => a.localeCompare(b));

  const sections: string[] = [];
  sections.push("# Bard's Journal Export");
  sections.push('');
  sections.push('## Export Metadata');
  sections.push('- format_version: 1');
  sections.push('- export_type: journal_day_group');
  sections.push(`- exported_at: ${exportedAt}`);
  sections.push('- exported_by_role: admin');
  sections.push(`- campaign_id: ${params.campaignId}`);
  sections.push(`- campaign_name: ${params.campaignName}`);
  sections.push(`- group_key_date: ${params.day}`);
  sections.push(`- group_title: ${normalizedGroupTitle}`);
  sections.push(`- includes_private_entries: ${includesPrivateEntries ? 'true' : 'false'}`);
  sections.push('- sort_order: createdAt_asc');
  sections.push('');
  sections.push('## Participants (observed in this group)');
  if (participants.length === 0) {
    sections.push('- none');
  } else {
    participants.forEach((participant) => sections.push(`- ${participant}`));
  }
  sections.push('');
  sections.push('---');
  sections.push('');

  sortedNotes.forEach((note, index) => {
    sections.push(`## Entry ${index + 1}`);
    sections.push(`- entry_id: ${note.id}`);
    sections.push(`- timestamp: ${note.createdAt}`);
    if (note.updatedAt && note.updatedAt !== note.createdAt) {
      sections.push(`- updated_at: ${note.updatedAt}`);
    }
    sections.push(`- visibility: ${note.visibility || 'public'}`);
    sections.push(`- author_role: ${note.userRole || 'user'}`);
    sections.push(`- author_display: ${noteAuthorDisplay(note)}`);
    sections.push(`- character_name: ${note.userRole === 'admin' ? 'null' : (note.characterName || 'null')}`);
    if (note.dndBeyondUrl) {
      sections.push(`- dndbeyond_url: ${note.dndBeyondUrl}`);
    }
    sections.push('');
    sections.push('### Content');
    sections.push(htmlToPlainText(note.contentHtml) || '(empty)');
    sections.push('');
    sections.push('---');
    sections.push('');
  });

  return {
    filename: `${slugify(params.campaignName)}-${params.day}-${slugify(normalizedGroupTitle)}.md`,
    markdown: sections.join('\n'),
  };
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
