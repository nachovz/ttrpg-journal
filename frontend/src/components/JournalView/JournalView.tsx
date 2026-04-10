import { useEffect, useMemo, useState, type FormEvent } from 'react';
import ReactQuill from 'react-quill-new';
import { useMatch, useNavigate } from 'react-router-dom';
import { AdminJournalChat } from '../AdminJournalChat/AdminJournalChat';
import { UserJournalList } from '../UserJournalList/UserJournalList';
import { useSession } from '../../context/SessionContext/SessionContext';
import { selectedCampaignStorage } from '../../services/selectedCampaignStorage';
import { buildJournalDayExportMarkdown, downloadTextFile } from '../../utils/journalDayExport';
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
  const [entryVisibility, setEntryVisibility] = useState<'public' | 'private'>('public');
  const [campaignDetails, setCampaignDetails] = useState<Campaign | null>(null);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [isCampaignInvalid, setIsCampaignInvalid] = useState(false);

  useEffect(() => {
    setEntryVisibility(me?.role === 'admin' ? 'private' : 'public');
  }, [me?.role]);

  useEffect(() => {
    if (!currentCampaignId) {
      const storedCampaignId = selectedCampaignStorage.getSelectedCampaignId();
      if (storedCampaignId) {
        navigate(`/journal/${encodeURIComponent(storedCampaignId)}`, { replace: true });
        return;
      }
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
        selectedCampaignStorage.setSelectedCampaignId(currentCampaignId);
        setCampaignDetails(campaign);
      })
      .catch(() => {
        if (cancelled) return;
        if (selectedCampaignStorage.getSelectedCampaignId() === currentCampaignId) {
          selectedCampaignStorage.clearSelectedCampaignId();
        }
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
  }, [currentCampaignId, fetchCampaignById, navigate]);

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

  async function handleCreateNote(event: FormEvent) {
    event.preventDefault();

    try {
      await createNote({
        contentHtml: editorHtml,
        campaignId: currentCampaignId,
        visibility: entryVisibility,
      });
      setEditorHtml('');
      setEntryVisibility(me?.role === 'admin' ? 'private' : 'public');
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

  function handleExportDayGroup(day: string) {
    if (me?.role !== 'admin' || !currentCampaignId) return;

    const dayGroup = adminDayGroups.find((group) => group.day === day);
    if (!dayGroup) {
      setError('Unable to export: journal day group not found');
      return;
    }

    const groupTitle = String(dayLabelByKey.get(`${currentCampaignId}:${day}`) || '').trim();
    if (!groupTitle) {
      setError('Name this day before exporting the group');
      return;
    }

    const { filename, markdown } = buildJournalDayExportMarkdown({
      campaignId: currentCampaignId,
      campaignName: campaignDetails?.name || 'Campaign',
      day,
      groupTitle,
      notes: dayGroup.notes,
    });

    downloadTextFile(filename, markdown);
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
    <section className="card journal-chat-card">
      <div className="journal-chat-messages">
        {me?.role === 'admin' ? (
          <AdminJournalChat
            campaignName={campaignDetails?.name || ''}
            currentUserId={me?.uid || ''}
            dayGroups={adminDayGroups}
            dayLabelByKey={dayLabelByKey}
            isLoading={isLoading}
            selectedCampaignId={currentCampaignId}
            onExportDayGroup={handleExportDayGroup}
            onRenameDayGroup={handleRenameDayGroup}
          />
        ) : (
          <UserJournalList
            currentUserId={me?.uid || ''}
            dayLabelByKey={dayLabelByKey}
            groups={[
              {
                campaignId: currentCampaignId,
                campaignName: campaignDetails?.name || 'Campaign',
                notes: campaignNotes,
              },
            ]}
          />
        )}
      </div>

      <div className="journal-chat-composer">
        <form onSubmit={handleCreateNote} className="form">
          <label className="ios-switch">
            <input
              className="ios-switch-input"
              type="checkbox"
              role="switch"
              checked={entryVisibility === 'private'}
              onChange={(event) => setEntryVisibility(event.target.checked ? 'private' : 'public')}
            />
            <span className="ios-switch-label">
              {entryVisibility === 'private'
                ? 'Private entry'
                : 'Public entry'}
            </span>
          </label>

          <ReactQuill className="editor" theme="snow" value={editorHtml} onChange={setEditorHtml} placeholder={JOURNAL_PLACEHOLDER} />
          <button disabled={isLoading || !currentCampaignId} type="submit">Save note</button>
        </form>
      </div>
    </section>
  );
}
