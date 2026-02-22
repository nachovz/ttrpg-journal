import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../context/SessionContext/SessionContext';
import type { AppHeaderProps } from './types';

export function AppHeader({}: AppHeaderProps) {
  const { me, logout, theme, toggleTheme } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = location.pathname === '/campaigns' ? 'campaigns' : location.pathname === '/profile' ? 'profile' : 'journal';
  const userDisplayName = me?.characterName || me?.username || 'Adventurer';

  return (
    <header className="top-nav">
      <div className="top-nav-brand">
        <h1>Bard's Journal</h1>
      </div>

      <nav className="tabs top-nav-tabs" aria-label="Main navigation">
        <button className={activeView === 'journal' ? 'active' : ''} onClick={() => navigate('/journal')} type="button">
          Journal
        </button>
        <button className={activeView === 'campaigns' ? 'active' : ''} onClick={() => navigate('/campaigns')} type="button">
          Campaigns
        </button>
      </nav>

      <div className="top-nav-actions">
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
        <details className="user-menu">
          <summary>
            <span className="header-avatar header-avatar-sm">
              {me?.profileImageUrl ? <img alt={`${userDisplayName} avatar`} src={me.profileImageUrl} /> : '🧙'}
            </span>
            <span className="top-nav-user-name">{userDisplayName}</span>
          </summary>
          <div className="user-menu-panel">
            <div className="header-avatar">
              {me?.profileImageUrl ? <img alt={`${userDisplayName} avatar`} src={me.profileImageUrl} /> : '🧙'}
            </div>
            <p>{userDisplayName}</p>
            <button
              className={activeView === 'profile' ? 'user-menu-button active' : 'user-menu-button'}
              onClick={() => navigate('/profile')}
              type="button"
            >
              Profile
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
