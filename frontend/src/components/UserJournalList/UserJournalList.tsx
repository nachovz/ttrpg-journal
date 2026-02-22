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

export function UserJournalList({ dayLabelByKey, groups }: UserJournalListProps) {
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
                        <article className="note" key={note.id}>
                          <div className="meta">
                            {note.profileImageUrl ? (
                              <img className="note-avatar" alt={`${note.username || note.userEmail} avatar`} src={note.profileImageUrl} />
                            ) : null}
                            <strong>{note.username || note.userEmail}</strong>
                            {note.characterName ? <span>Character: {note.characterName}</span> : null}
                            {note.dndBeyondUrl ? (
                              <a href={note.dndBeyondUrl} target="_blank" rel="noreferrer">
                                Character sheet
                              </a>
                            ) : null}
                            <span>Created at: {new Date(note.createdAt).toLocaleString()}</span>
                            {note.updatedAt ? <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span> : null}
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
