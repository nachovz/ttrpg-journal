import { useNavigate } from 'react-router-dom';
import { useSession } from '../../context/SessionContext/SessionContext';
import { selectedCampaignStorage } from '../../services/selectedCampaignStorage';
import type { CampaignsViewProps } from './types';

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
}

export function CampaignsView({}: CampaignsViewProps) {
  const navigate = useNavigate();
  const {
    campaigns,
    campaignNameInput,
    createCampaign,
    deleteCampaign,
    isLoading,
    joinCampaign,
    joinCodeInput,
    me,
    setCampaignNameInput,
    setJoinCodeInput,
  } = useSession();

  function handleOpenCampaignJournal(campaignId: string) {
    selectedCampaignStorage.setSelectedCampaignId(campaignId);
    navigate(`/journal/${encodeURIComponent(campaignId)}`);
  }

  return (
    <>
      <section className="card">
        <h2>Campaign Tools</h2>
        <div className="campaign-toolbar">
          <form onSubmit={joinCampaign} className="form inline-form campaign-toolbar-form">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(event) => setJoinCodeInput(event.target.value.toUpperCase())}
              placeholder="Join code"
            />
            <button disabled={isLoading} type="submit">
              Join
            </button>
          </form>

          {me?.role === 'admin' ? (
            <form onSubmit={createCampaign} className="form inline-form campaign-toolbar-form">
              <input
                type="text"
                value={campaignNameInput}
                onChange={(event) => setCampaignNameInput(event.target.value)}
                placeholder="Campaign name"
                maxLength={80}
                required
              />
              <button disabled={isLoading} type="submit">
                Create
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>My Campaigns</h2>
        {campaigns.length === 0 ? <p>No campaigns yet. Join one from a link or code.</p> : null}
        <div className="campaign-list">
          {campaigns.map((campaign) => (
            <article className="campaign-item campaign-card" key={campaign.id}>
              <strong className="campaign-title">{campaign.name}</strong>
              <span>Join code: {campaign.joinCode}</span>
              <a href={campaign.joinLink} target="_blank" rel="noreferrer">
                {campaign.joinLink}
              </a>
              <div className="campaign-stats">
                <span className="hint">Entries: {campaign.entryCount || 0}</span>
                <span className="hint">Members: {campaign.memberIds.length}</span>
              </div>
              <div className="campaign-members">
                {(campaign.memberCharacterNames || []).length > 0 ? (
                  (campaign.memberCharacterNames || []).map((memberName) => (
                    <span className="campaign-member-chip" key={`${campaign.id}-${memberName}`}>
                      {memberName}
                    </span>
                  ))
                ) : (
                  <span className="hint">No character names yet</span>
                )}
              </div>
              {me?.role === 'admin' ? <span className="hint">Created: {formatDateTime(campaign.createdAt)}</span> : null}
              <span className="hint">Last updated: {formatDateTime(campaign.updatedAt || campaign.createdAt)}</span>
              <div className="campaign-actions">
                <button disabled={isLoading} onClick={() => handleOpenCampaignJournal(campaign.id)} type="button">
                  Load campaign journal
                </button>
                {me?.role === 'admin' ? (
                  <button className="button-danger" disabled={isLoading} onClick={() => deleteCampaign(campaign)} type="button">
                    Delete campaign
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
