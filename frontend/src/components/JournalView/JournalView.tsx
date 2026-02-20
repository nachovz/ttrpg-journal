import { useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import { AdminJournalChat } from '../AdminJournalChat/AdminJournalChat';
import { UserJournalList } from '../UserJournalList/UserJournalList';
import { useSession } from '../../context/SessionContext/SessionContext';
import type { Note } from '../../types/entities';
import type { JournalViewProps } from './types';

const JOURNAL_PLACEHOLDER =
  "Bard's notebook entry: session #, date, location, party members, key NPCs, quests/objectives, major decisions, combat outcomes, loot/rewards, unresolved mysteries, and next steps. Write clearly so future chronicles can continue this campaign accurately.";

function getNoteDay(note: Note) {
  return String(note.entryDate || '').trim() || String(note.createdAt || '').slice(0, 10) || 'Unknown';
}

export function JournalView({ showInvalidCampaignPage, onGoToCampaigns, onGoToJournal }: JournalViewProps) {
  const {
    campaigns,
    createNote,
    isLoading,
    journalDayLabels,
    me,
    notes,
    selectedCampaignId,
    setError,
    setDayGroupTitle,
  } = useSession();

  const [editorHtml, setEditorHtml] = useState('');
  const [adminEntryVisibility, setAdminEntryVisibility] = useState<'public' | 'private'>('private');

  const notesByCampaign = useMemo(() => {
    const groupedByCampaign = new Map<string, Note[]>();
    for (const note of notes) {
      const campaignId = note.campaignId || 'uncategorized';
      if (!groupedByCampaign.has(campaignId)) groupedByCampaign.set(campaignId, []);
      groupedByCampaign.get(campaignId)?.push(note);
    }

    return Array.from(groupedByCampaign.entries())
      .map(([campaignId, campaignNotes]) => {
        const campaign = campaigns.find((item) => item.id === campaignId);
        return {
          campaignId,
          campaignName: campaign?.name || campaignNotes[0]?.campaignName || 'Uncategorized',
          notes: campaignNotes,
        };
      })
      .sort((a, b) => a.campaignName.localeCompare(b.campaignName));
  }, [campaigns, notes]);

  const visibleNotesByCampaign = useMemo(() => {
    if (me?.role !== 'admin') return notesByCampaign;
    if (!selectedCampaignId) return [];
    return notesByCampaign.filter((group) => group.campaignId === selectedCampaignId);
  }, [me?.role, notesByCampaign, selectedCampaignId]);

  const adminDayGroups = useMemo(() => {
    if (me?.role !== 'admin') return [];

    const selectedGroup = visibleNotesByCampaign[0];
    if (!selectedGroup) return [];

    const groupedByDay = new Map<string, Note[]>();
    for (const note of [...selectedGroup.notes].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      const day = getNoteDay(note);
      if (!groupedByDay.has(day)) groupedByDay.set(day, []);
      groupedByDay.get(day)?.push(note);
    }

    return Array.from(groupedByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayNotes]) => ({ day, notes: dayNotes }));
  }, [me?.role, visibleNotesByCampaign]);

  const dayLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of journalDayLabels) {
      map.set(`${item.campaignId}:${item.entryDate}`, item.title || '');
    }
    return map;
  }, [journalDayLabels]);

  async function handleCreateNote(event: React.FormEvent) {
    event.preventDefault();

    try {
      await createNote({
        contentHtml: editorHtml,
        campaignId: selectedCampaignId,
        visibility: me?.role === 'admin' ? adminEntryVisibility : undefined,
      });
      setEditorHtml('');
      setAdminEntryVisibility('private');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save note');
    }
  }

  async function handleRenameDayGroup(day: string) {
    if (!selectedCampaignId || me?.role !== 'admin') return;

    const key = `${selectedCampaignId}:${day}`;
    const existingTitle = dayLabelByKey.get(key) || '';
    const nextTitle = window.prompt('Set a title for this journal day group (leave empty to clear):', existingTitle);
    if (nextTitle === null) return;

    try {
      await setDayGroupTitle({ campaignId: selectedCampaignId, day, title: nextTitle.trim() });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update day title');
    }
  }

  if (showInvalidCampaignPage) {
    return (
      <section className="card">
        <h2>Campaign Not Found</h2>
        <p className="error">The campaign ID in this URL is invalid or you do not have access to it.</p>
        <div className="inline-form">
          <button onClick={onGoToCampaigns} type="button">Go to campaigns</button>
          <button onClick={onGoToJournal} type="button">Open my journal</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2>New Entry</h2>
        <form onSubmit={handleCreateNote} className="form">
          {me?.role === 'admin' ? (
            <label>
              Visibility
              <select value={adminEntryVisibility} onChange={(event) => setAdminEntryVisibility(event.target.value as 'public' | 'private')}>
                <option value="private">Private (admin only)</option>
                <option value="public">Public (all campaign members)</option>
              </select>
            </label>
          ) : null}

          <ReactQuill className="editor" theme="snow" value={editorHtml} onChange={setEditorHtml} placeholder={JOURNAL_PLACEHOLDER} />
          <button disabled={isLoading || !selectedCampaignId} type="submit">Save note</button>
        </form>
      </section>

      <section className="card">
        {me?.role === 'admin' ? (
          <AdminJournalChat
            campaignName={visibleNotesByCampaign[0]?.campaignName || ''}
            dayGroups={adminDayGroups}
            dayLabelByKey={dayLabelByKey}
            isLoading={isLoading}
            selectedCampaignId={selectedCampaignId}
            onRenameDayGroup={handleRenameDayGroup}
          />
        ) : (
          <UserJournalList groups={visibleNotesByCampaign} />
        )}
      </section>
    </>
  );
}
