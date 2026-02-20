import { useSession } from '../../context/SessionContext/SessionContext';
import type { CampaignsViewProps } from './types';

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
}

export function CampaignsView({ onLoadCampaignJournal }: CampaignsViewProps) {
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

  return (
    <>
      <section className="card">
        <h2>Join Campaign</h2>
        <form onSubmit={joinCampaign} className="form inline-form">
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
      </section>

      {me?.role === 'admin' ? (
        <section className="card">
          <h2>Create Campaign</h2>
          <form onSubmit={createCampaign} className="form inline-form">
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
        </section>
      ) : null}

      <section className="card">
        <h2>My Campaigns</h2>
        {campaigns.length === 0 ? <p>No campaigns yet. Join one from a link or code.</p> : null}
        <div className="campaign-list">
          {campaigns.map((campaign) => (
            <article className="campaign-item" key={campaign.id}>
              <strong>{campaign.name}</strong>
              <span>Join code: {campaign.joinCode}</span>
              <a href={campaign.joinLink} target="_blank" rel="noreferrer">
                {campaign.joinLink}
              </a>
              {me?.role === 'admin' ? <span className="hint">Created: {formatDateTime(campaign.createdAt)}</span> : null}
              <span className="hint">Last updated: {formatDateTime(campaign.updatedAt || campaign.createdAt)}</span>
              <button disabled={isLoading} onClick={() => onLoadCampaignJournal(campaign.id)} type="button">
                Load campaign journal
              </button>
              {me?.role === 'admin' ? (
                <button className="button-danger" disabled={isLoading} onClick={() => deleteCampaign(campaign)} type="button">
                  Delete campaign
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
