import type { CSSProperties } from 'react';
import { getNoteTintHue } from '../../utils/noteTint';
import type { UserJournalListProps } from './types';

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
  username?: string;
  userEmail?: string;
}) {
  if (note.userRole === 'admin') return 'DM';
  return note.username || note.userEmail || 'Unknown';
}

function getNoteCharacterLabel(note: {
  userRole?: string;
  characterName?: string;
}) {
  if (note.userRole === 'admin') return '';
  return note.characterName || '';
}

export function UserJournalList({ currentUserId, dayLabelByKey, groups }: UserJournalListProps) {
  return (
    <>
      {groups.length === 0 ? <p>No entries yet.</p> : null}

      <div className="notes-group-list">
        {groups.map((group) => (
          <section className="note-group" key={group.campaignId}>
            <h3>{group.campaignName}</h3>
            <div className="chat-day-list">
              {Object.entries(
                group.notes.reduce<Record<string, typeof group.notes>>((accumulator, note) => {
                  const dayKey = String(note.entryDate || '').trim() || String(note.createdAt || '').slice(0, 10) || 'Unknown';
                  if (!accumulator[dayKey]) accumulator[dayKey] = [];
                  accumulator[dayKey].push(note);
                  return accumulator;
                }, {})
              )
                .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
                .map(([day, dayNotes]) => (
                  <section className="chat-day-group" key={`${group.campaignId}-${day}`}>
                    <div className="chat-day-header">
                      <h4 className="chat-day-heading">
                        {dayLabelByKey.get(`${group.campaignId}:${day}`) || formatDayLabel(day)}
                      </h4>
                    </div>
                    <div className="notes-grid">
                      {dayNotes.map((note) => (
                        <article
                          className={`note note-tinted ${note.userId === currentUserId ? 'is-own-note' : 'is-other-note'}`}
                          key={note.id}
                          style={{ '--note-tint-h': String(getNoteTintHue(note)) } as CSSProperties}
                        >
                          <div className="meta">
                            {note.profileImageUrl ? (
                              <img className="note-avatar" alt={`${getNoteDisplayName(note)} avatar`} src={note.profileImageUrl} />
                            ) : null}
                            <strong>{getNoteDisplayName(note)}</strong>
                            {getNoteCharacterLabel(note) ? <span>Character: {getNoteCharacterLabel(note)}</span> : null}
                            {note.dndBeyondUrl ? (
                              <a href={note.dndBeyondUrl} target="_blank" rel="noreferrer">
                                Character sheet
                              </a>
                            ) : null}
                            <span className="note-meta-time">
                              {formatEntryDateTime(note.updatedAt || note.createdAt)}
                            </span>
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: note.contentHtml }} />
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
