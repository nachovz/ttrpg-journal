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

export function AdminJournalChat({
  campaignName,
  dayGroups,
  dayLabelByKey,
  isLoading,
  selectedCampaignId,
  onRenameDayGroup,
}: AdminJournalChatProps) {
  return (
    <>
      <h2>Campaign Journal Chat</h2>
      {campaignName ? <h3>{campaignName}</h3> : null}
      {dayGroups.length === 0 ? <p>No entries for the selected campaign.</p> : null}

      <div className="chat-day-list">
        {dayGroups.map((dayGroup) => (
          <section className="chat-day-group" key={dayGroup.day}>
            <div className="chat-day-header">
              <h4 className="chat-day-heading">
                {dayLabelByKey.get(`${selectedCampaignId}:${dayGroup.day}`) || formatDayLabel(dayGroup.day)}
              </h4>
              <button disabled={isLoading} onClick={() => onRenameDayGroup(dayGroup.day)} type="button">
                Name this day
              </button>
            </div>

            <div className="chat-thread">
              {dayGroup.notes.map((note) => (
                <article className="note chat-message" key={note.id}>
                  <div className="meta chat-meta">
                    {note.profileImageUrl ? (
                      <img className="note-avatar" alt={`${note.username || note.userEmail} avatar`} src={note.profileImageUrl} />
                    ) : (
                      <div className="note-avatar note-avatar-fallback" aria-hidden="true">
                        🧙
                      </div>
                    )}
                    <div className="chat-author">
                      <strong>{note.username || note.userEmail}</strong>
                      <span>Character: {note.characterName || 'Not set'}</span>
                    </div>
                    <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {note.userRole === 'admin' ? <span>{note.visibility === 'public' ? 'Public' : 'Private'}</span> : null}
                    {note.dndBeyondUrl ? (
                      <a href={note.dndBeyondUrl} target="_blank" rel="noreferrer">
                        Character sheet
                      </a>
                    ) : null}
                  </div>
                  <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: note.contentHtml }} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
