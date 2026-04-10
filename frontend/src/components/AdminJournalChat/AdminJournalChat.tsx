import type { CSSProperties } from 'react';
import { getNoteTintHue } from '../../utils/noteTint';
import { sanitizeNoteHtml } from '../../utils/sanitizeHtml';
import type { AdminJournalChatProps } from './types';

function formatDayLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatEntryDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNoteDisplayName(note: {
  userRole?: string;
  characterName?: string;
  username?: string;
  userEmail?: string;
}) {
  if (note.userRole === 'admin') return 'DM';
  return note.characterName || note.username || note.userEmail || 'Unknown';
}

function getNoteCharacterLabel(note: {
  userRole?: string;
  characterName?: string;
}) {
  if (note.userRole === 'admin') return '';
  return note.characterName || 'Not set';
}

export function AdminJournalChat({
  campaignName,
  currentUserId,
  dayGroups,
  dayLabelByKey,
  isLoading,
  selectedCampaignId,
  onExportDayGroup,
  onRenameDayGroup,
}: AdminJournalChatProps) {
  return (
    <>
      {campaignName ? <h3>{campaignName}</h3> : null}
      {dayGroups.length === 0 ? <p>No entries for the selected campaign.</p> : null}

      <div className="chat-day-list">
        {dayGroups.map((dayGroup) => {
          const dayLabelKey = `${selectedCampaignId}:${dayGroup.day}`;
          const customDayTitle = String(dayLabelByKey.get(dayLabelKey) || '').trim();

          return (
            <section className="chat-day-group" key={dayGroup.day}>
              <div className="chat-day-header">
                <h4 className="chat-day-heading">{customDayTitle || formatDayLabel(dayGroup.day)}</h4>
                <div className="chat-day-actions">
                  <button disabled={isLoading || !customDayTitle} onClick={() => onExportDayGroup(dayGroup.day)} type="button">
                    Export group
                  </button>
                  <button disabled={isLoading} onClick={() => onRenameDayGroup(dayGroup.day)} type="button">
                    Name this day
                  </button>
                </div>
              </div>

              <div className="chat-thread">
                {dayGroup.notes.map((note) => (
                  <article
                    className={`note note-tinted chat-message ${note.userId === currentUserId ? 'is-own-note' : 'is-other-note'}`}
                    key={note.id}
                    style={{ '--note-tint-h': String(getNoteTintHue(note)) } as CSSProperties}
                  >
                    <div className="meta chat-meta">
                      {note.profileImageUrl ? (
                        <img className="note-avatar" alt={`${getNoteDisplayName(note)} avatar`} src={note.profileImageUrl} />
                      ) : (
                        <div className="note-avatar note-avatar-fallback" aria-hidden="true">
                          🧙
                        </div>
                      )}
                      <div className="chat-author">
                        <strong>{getNoteDisplayName(note)}</strong>
                        {getNoteCharacterLabel(note) ? <span>Character: {getNoteCharacterLabel(note)}</span> : null}
                      </div>
                      <span className="note-meta-time">{formatEntryDateTime(note.updatedAt || note.createdAt)}</span>
                      {note.userRole === 'admin' ? <span>{note.visibility === 'public' ? 'Public' : 'Private'}</span> : null}
                      {note.dndBeyondUrl ? (
                        <a href={note.dndBeyondUrl} target="_blank" rel="noreferrer">
                          Character sheet
                        </a>
                      ) : null}
                    </div>
                    <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.contentHtml) }} />
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
