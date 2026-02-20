import { useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import { useMatch, useNavigate } from 'react-router-dom';
import { AdminJournalChat } from '../AdminJournalChat/AdminJournalChat';
import { UserJournalList } from '../UserJournalList/UserJournalList';
import { useSession } from '../../context/SessionContext/SessionContext';
import type { Campaign, Note } from '../../types/entities';
import type { JournalViewProps } from './types';

const JOURNAL_PLACEHOLDER =
  "Bard's notebook entry: session #, date, location, party members, key NPCs, quests/objectives, major decisions, combat outcomes, loot/rewards, unresolved mysteries, and next steps. Write clearly so future chronicles can continue this campaign accurately.";

function getNoteDay(note: Note) {
  return String(note.entryDate || '').trim() || String(note.createdAt || '').slice(0, 10) || 'Unknown';
}

export function JournalView({}: JournalViewProps) {
  const navigate = useNavigate();
  const {
    createNote,
    fetchCampaignById,
    isLoading,
    journalDayLabels,
    me,
    notes,
    setError,
    setDayGroupTitle,
  } = useSession();
  const journalMatch = useMatch('/journal/:campaignId');
  const currentCampaignId = (journalMatch?.params?.campaignId || '').trim();

  const [editorHtml, setEditorHtml] = useState('');
  const [adminEntryVisibility, setAdminEntryVisibility] = useState<'public' | 'private'>('private');
  const [campaignDetails, setCampaignDetails] = useState<Campaign | null>(null);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [isCampaignInvalid, setIsCampaignInvalid] = useState(false);

  useEffect(() => {
    if (!currentCampaignId) {
      setCampaignDetails(null);
      setIsCampaignInvalid(false);
      setIsCampaignLoading(false);
      return;
    }

    let cancelled = false;
    setIsCampaignLoading(true);
    setIsCampaignInvalid(false);

    fetchCampaignById(currentCampaignId)
      .then((campaign) => {
        if (cancelled) return;
        setCampaignDetails(campaign);
      })
      .catch(() => {
        if (cancelled) return;
        setCampaignDetails(null);
        setIsCampaignInvalid(true);
      })
      .finally(() => {
        if (cancelled) return;
        setIsCampaignLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentCampaignId, fetchCampaignById]);

  const campaignNotes = useMemo(() => {
    if (!currentCampaignId) return [];
    return notes.filter((note) => note.campaignId === currentCampaignId);
  }, [currentCampaignId, notes]);

  const adminDayGroups = useMemo(() => {
    if (me?.role !== 'admin') return [];

    const groupedByDay = new Map<string, Note[]>();
    for (const note of [...campaignNotes].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      const day = getNoteDay(note);
      if (!groupedByDay.has(day)) groupedByDay.set(day, []);
      groupedByDay.get(day)?.push(note);
    }

    return Array.from(groupedByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayNotes]) => ({ day, notes: dayNotes }));
  }, [campaignNotes, me?.role]);

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
        campaignId: currentCampaignId,
        visibility: me?.role === 'admin' ? adminEntryVisibility : undefined,
      });
      setEditorHtml('');
      setAdminEntryVisibility('private');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save note');
    }
  }

  async function handleRenameDayGroup(day: string) {
    if (!currentCampaignId || me?.role !== 'admin') return;

    const key = `${currentCampaignId}:${day}`;
    const existingTitle = dayLabelByKey.get(key) || '';
    const nextTitle = window.prompt('Set a title for this journal day group (leave empty to clear):', existingTitle);
    if (nextTitle === null) return;

    try {
      await setDayGroupTitle({ campaignId: currentCampaignId, day, title: nextTitle.trim() });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update day title');
    }
  }

  if (!currentCampaignId) {
    return (
      <section className="card">
        <h2>Select a Campaign</h2>
        <p className="hint">Load a campaign from the Campaigns view to open its journal permalink.</p>
        <button onClick={() => navigate('/campaigns')} type="button">Open list</button>
      </section>
    );
  }

  if (isCampaignLoading && !campaignDetails) {
    return (
      <section className="card">
        <h2>Loading campaign...</h2>
      </section>
    );
  }

  if (isCampaignInvalid) {
    return (
      <section className="card">
        <h2>Campaign Not Found</h2>
        <p className="error">The campaign ID in this URL is invalid or you do not have access to it.</p>
        <div className="inline-form">
          <button onClick={() => navigate('/campaigns')} type="button">Open list</button>
          <button onClick={() => navigate('/journal')} type="button">Open my journal</button>
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
          <button disabled={isLoading || !currentCampaignId} type="submit">Save note</button>
        </form>
      </section>

      <section className="card">
        {me?.role === 'admin' ? (
          <AdminJournalChat
            campaignName={campaignDetails?.name || ''}
            dayGroups={adminDayGroups}
            dayLabelByKey={dayLabelByKey}
            isLoading={isLoading}
            selectedCampaignId={currentCampaignId}
            onRenameDayGroup={handleRenameDayGroup}
          />
        ) : (
          <UserJournalList
            groups={[
              {
                campaignId: currentCampaignId,
                campaignName: campaignDetails?.name || 'Campaign',
                notes: campaignNotes,
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
