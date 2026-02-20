import { useSession } from '../../context/SessionContext/SessionContext';
import type { AppHeaderProps } from './types';

export function AppHeader({ activeView, onNavigateToView }: AppHeaderProps) {
  const { me, logout, theme, toggleTheme } = useSession();

  return (
    <section className="card header-card">
      <div className="header-user">
        <div className="header-avatar">
          {me?.profileImageUrl ? <img alt={`${me.username || 'User'} avatar`} src={me.profileImageUrl} /> : '🧙'}
        </div>
        <div className="header-info">
          <h1>Bard's Journal</h1>
          <p>{me?.username || me?.email}</p>
          <p className="hint">{me?.email}</p>
          {me?.role === 'admin' ? <p className="hint">Role: admin</p> : null}
          {me?.role === 'admin' ? <p className="hint">Admin mode: campaign creation enabled</p> : null}
        </div>
      </div>

      <div className="header-actions">
        <div className="tabs">
          <button className={activeView === 'journal' ? 'active' : ''} onClick={() => onNavigateToView('journal')} type="button">
            Journal
          </button>
          <button className={activeView === 'campaigns' ? 'active' : ''} onClick={() => onNavigateToView('campaigns')} type="button">
            Campaigns
          </button>
          <button className={activeView === 'profile' ? 'active' : ''} onClick={() => onNavigateToView('profile')} type="button">
            Profile
          </button>
          <button onClick={logout} type="button">
            Logout
          </button>
          <button
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            type="button"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
