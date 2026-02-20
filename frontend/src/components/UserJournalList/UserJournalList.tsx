import type { UserJournalListProps } from './types';

export function UserJournalList({ groups }: UserJournalListProps) {
  return (
    <>
      <h2>Campaign Journal Entries</h2>
      {groups.length === 0 ? <p>No entries yet.</p> : null}

      <div className="notes-group-list">
        {groups.map((group) => (
          <section className="note-group" key={group.campaignId}>
            <h3>{group.campaignName}</h3>
            <div className="notes-grid">
              {group.notes.map((note) => (
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
                    <span>Entry date: {note.entryDate}</span>
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
    </>
  );
}
