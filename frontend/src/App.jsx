import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import { auth } from './firebase';
import { apiRequest } from './api';

const emptyAuthForm = { email: '', password: '' };
const emptyProfileForm = { username: '', characterName: '', dndBeyondUrl: '', profileImageUrl: '' };
const emptyCampaignForm = { name: '' };
const journalPlaceholder =
  "Bard's notebook entry: session #, date, location, party members, key NPCs, quests/objectives, major decisions, combat outcomes, loot/rewards, unresolved mysteries, and next steps. Write clearly so future chronicles can continue this campaign accurately.";

export default function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [me, setMe] = useState(null);
  const [notes, setNotes] = useState([]);
  const [journalDayLabels, setJournalDayLabels] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [theme, setTheme] = useState('light');
  const [autoJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('join') || '').trim().toUpperCase();
  });
  const location = useLocation();
  const navigate = useNavigate();
  const journalMatch = useMatch('/journal/:campaignId');
  const routeCampaignId = (journalMatch?.params?.campaignId || '').trim();

  const activeView = useMemo(() => {
    if (location.pathname === '/campaigns') return 'campaigns';
    if (location.pathname === '/profile') return 'profile';
    return 'journal';
  }, [location.pathname]);

  const isJournalRoute = location.pathname.startsWith('/journal');
  const isRouteCampaignValid = Boolean(routeCampaignId) && campaigns.some((campaign) => campaign.id === routeCampaignId);
  const showInvalidCampaignPage = isJournalRoute && Boolean(routeCampaignId) && Boolean(me) && !isLoading && !isRouteCampaignValid;

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextTheme = storedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (isMounted) {
        setIsAuthInitializing(false);
        setError('Session check timed out. You can still log in manually.');
      }
    }, 5000);

    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setFirebaseUser(user);
        setIsAuthInitializing(false);
      },
      () => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setIsAuthInitializing(false);
        setError('Unable to verify session. Please log in again.');
      }
    );

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setMe(null);
      setNotes([]);
      setJournalDayLabels([]);
      setCampaigns([]);
      setSelectedCampaignId('');
      setAutoJoinAttempted(false);
      return;
    }

    refreshSession();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      return;
    }
    if (!(location.pathname.startsWith('/journal') || ['/campaigns', '/profile'].includes(location.pathname))) {
      navigate('/journal', { replace: true });
    }
  }, [firebaseUser, location.pathname, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (!firebaseUser || !autoJoinCode || autoJoinAttempted) {
      return;
    }

    setAutoJoinAttempted(true);
    joinCampaignByCode(autoJoinCode, true).finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    });
  }, [firebaseUser, autoJoinCode, autoJoinAttempted]);

  useEffect(() => {
    function applyQuillA11yLabels() {
      const buttonLabels = {
        'ql-bold': 'Bold',
        'ql-italic': 'Italic',
        'ql-underline': 'Underline',
        'ql-link': 'Insert link',
        'ql-clean': 'Clear formatting',
      };

      const listLabels = {
        ordered: 'Ordered list',
        bullet: 'Bullet list',
      };

      document.querySelectorAll('.ql-toolbar').forEach((toolbar) => {
        toolbar.querySelectorAll('button').forEach((button) => {
          let label = '';

          for (const [className, value] of Object.entries(buttonLabels)) {
            if (button.classList.contains(className)) {
              label = value;
              break;
            }
          }

          if (!label && button.classList.contains('ql-list')) {
            label = listLabels[button.value] || 'List style';
          }
          if (!label) {
            label = 'Editor control';
          }

          button.setAttribute('aria-label', label);
          button.setAttribute('title', label);
        });

        toolbar.querySelectorAll('.ql-picker-label').forEach((pickerLabel) => {
          const label = 'Text style';
          pickerLabel.setAttribute('aria-label', label);
          pickerLabel.setAttribute('title', label);
        });
      });
    }

    const rafId = window.requestAnimationFrame(() => applyQuillA11yLabels());

    const observers = [];
    document.querySelectorAll('.ql-toolbar').forEach((toolbar) => {
      const observer = new MutationObserver(() => applyQuillA11yLabels());
      observer.observe(toolbar, { childList: true, subtree: true });
      observers.push(observer);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [activeView]);

  const greeting = useMemo(() => {
    if (!me) return '';
    return me.role === 'admin' ? 'Admin mode: campaign creation enabled' : '';
  }, [me]);

  const notesByCampaign = useMemo(() => {
    const grouped = new Map();

    for (const note of notes) {
      const key = note.campaignId || 'uncategorized';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(note);
    }

    return Array.from(grouped.entries())
      .map(([campaignId, campaignNotes]) => {
        const campaign = campaigns.find((item) => item.id === campaignId);
        return {
          campaignId,
          campaignName: campaign?.name || campaignNotes[0]?.campaignName || 'Uncategorized',
          notes: campaignNotes,
        };
      })
      .sort((a, b) => a.campaignName.localeCompare(b.campaignName));
  }, [notes, campaigns]);

  const visibleNotesByCampaign = useMemo(() => {
    if (me?.role !== 'admin') {
      return notesByCampaign;
    }
    if (!selectedCampaignId) {
      return [];
    }
    return notesByCampaign.filter((group) => group.campaignId === selectedCampaignId);
  }, [me?.role, notesByCampaign, selectedCampaignId]);

  const adminCampaignNotes = useMemo(() => {
    if (me?.role !== 'admin') {
      return [];
    }
    const selectedGroup = visibleNotesByCampaign[0];
    if (!selectedGroup) {
      return [];
    }
    return [...selectedGroup.notes].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [me?.role, visibleNotesByCampaign]);

  const adminNotesByDay = useMemo(() => {
    const grouped = new Map();

    for (const note of adminCampaignNotes) {
      const dayKey = String(note.entryDate || '').trim() || String(note.createdAt || '').slice(0, 10) || 'Unknown';
      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey).push(note);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, notes]) => ({ day, notes }));
  }, [adminCampaignNotes]);

  const journalDayLabelByKey = useMemo(() => {
    const map = new Map();
    for (const item of journalDayLabels) {
      const key = `${item.campaignId}:${item.entryDate}`;
      map.set(key, item.title || '');
    }
    return map;
  }, [journalDayLabels]);

  const isSessionLoading = Boolean(firebaseUser) && isLoading && !me;

  async function withToken(fn) {
    if (!firebaseUser) throw new Error('Not authenticated');
    const token = await firebaseUser.getIdToken(true);
    return fn(token);
  }

  async function refreshSession() {
    setIsLoading(true);
    setError('');

    try {
      await withToken(async (token) => {
        const [meData, campaignsData, notesData, labelsData] = await Promise.all([
          apiRequest('/api/me', token),
          apiRequest('/api/campaigns', token),
          apiRequest('/api/notes', token),
          apiRequest('/api/journal-day-labels', token),
        ]);

        setMe(meData);
        setProfileForm({
          username: meData.username || '',
          characterName: meData.characterName || '',
          dndBeyondUrl: meData.dndBeyondUrl || '',
          profileImageUrl: meData.profileImageUrl || '',
        });

        setCampaigns(campaignsData);
        setNotes(notesData);
        setJournalDayLabels(labelsData);
        setSelectedCampaignId((previous) => {
          if (routeCampaignId && campaignsData.some((campaign) => campaign.id === routeCampaignId)) {
            return routeCampaignId;
          }
          if (previous && campaignsData.some((campaign) => campaign.id === previous)) {
            return previous;
          }
          return campaignsData[0]?.id || '';
        });
      });
    } catch (err) {
      setError(err.message || 'Unable to load session');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setAuthForm(emptyAuthForm);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    if (!selectedCampaignId) {
      setError('Select a campaign before saving a note');
      return;
    }
    if (!editorHtml || editorHtml === '<p><br></p>') {
      setError('Please add note content before saving');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await withToken(async (token) => {
        await apiRequest('/api/notes', token, {
          method: 'POST',
          body: JSON.stringify({ contentHtml: editorHtml, campaignId: selectedCampaignId }),
        });
      });

      setEditorHtml('');
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to save note');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await withToken(async (token) => {
        await apiRequest('/api/profile', token, {
          method: 'PUT',
          body: JSON.stringify(profileForm),
        });
      });
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to save profile');
    } finally {
      setIsLoading(false);
    }
  }

  async function joinCampaignByCode(joinCode, silent) {
    const normalizedCode = String(joinCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      if (!silent) setError('Join code is required');
      return;
    }

    try {
      await withToken(async (token) => {
        await apiRequest('/api/campaigns/join', token, {
          method: 'POST',
          body: JSON.stringify({ joinCode: normalizedCode }),
        });
      });

      if (!silent) {
        setJoinCodeInput('');
      }
      await refreshSession();
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Unable to join campaign');
      }
    }
  }

  async function handleJoinCampaign(event) {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await joinCampaignByCode(joinCodeInput, false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCampaign(event) {
    event.preventDefault();
    if (me?.role !== 'admin') {
      setError('Only admins can create campaigns');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await withToken(async (token) => {
        await apiRequest('/api/campaigns', token, {
          method: 'POST',
          body: JSON.stringify({ name: campaignForm.name }),
        });
      });
      setCampaignForm(emptyCampaignForm);
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to create campaign');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteCampaign(campaign) {
    if (me?.role !== 'admin') {
      setError('Only admins can delete campaigns');
      return;
    }

    const shouldDelete = window.confirm(
      `Delete campaign "${campaign.name}" and all its journal entries? This cannot be undone.`
    );
    if (!shouldDelete) {
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await withToken(async (token) => {
        await apiRequest(`/api/campaigns/${campaign.id}`, token, {
          method: 'DELETE',
        });
      });
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to delete campaign');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handleSetDayGroupTitle(day) {
    if (me?.role !== 'admin' || !selectedCampaignId) {
      return;
    }

    const currentTitle = journalDayLabelByKey.get(`${selectedCampaignId}:${day}`) || '';
    const nextTitle = window.prompt(
      'Set a title for this journal day group (leave empty to clear):',
      currentTitle
    );
    if (nextTitle === null) {
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      await withToken(async (token) => {
        await apiRequest(
          `/api/journal-day-labels/${encodeURIComponent(selectedCampaignId)}/${encodeURIComponent(day)}`,
          token,
          {
            method: 'PUT',
            body: JSON.stringify({ title: nextTitle.trim() }),
          }
        );
      });
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to update day title');
    } finally {
      setIsLoading(false);
    }
  }

  function goToView(view) {
    const path = view === 'campaigns' ? '/campaigns' : view === 'profile' ? '/profile' : '/journal';
    const pathWithCampaign =
      view === 'journal' && selectedCampaignId
        ? `${path}/${encodeURIComponent(selectedCampaignId)}`
        : path;
    if (location.pathname !== pathWithCampaign) {
      navigate(pathWithCampaign);
    }
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }

  function formatDateTime(value) {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString();
  }

  function formatDayLabel(value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  useEffect(() => {
    if (!campaigns.length || !routeCampaignId) {
      return;
    }
    if (!campaigns.some((campaign) => campaign.id === routeCampaignId)) {
      return;
    }
    if (routeCampaignId !== selectedCampaignId) {
      setSelectedCampaignId(routeCampaignId);
    }
  }, [campaigns, routeCampaignId, selectedCampaignId]);

  useEffect(() => {
    if (!location.pathname.startsWith('/journal')) {
      return;
    }
    if (showInvalidCampaignPage) {
      return;
    }
    if (routeCampaignId && routeCampaignId !== selectedCampaignId) {
      return;
    }
    if (!selectedCampaignId && routeCampaignId && campaigns.length > 0) {
      return;
    }
    const expectedPath = selectedCampaignId ? `/journal/${encodeURIComponent(selectedCampaignId)}` : '/journal';
    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true });
    }
  }, [campaigns.length, location.pathname, navigate, routeCampaignId, selectedCampaignId, showInvalidCampaignPage]);

  if (isAuthInitializing) {
    return (
      <main className="container">
        <section className="card auth-card">
          <h1>Bard's Journal</h1>
          <p>Loading session...</p>
        </section>
      </main>
    );
  }

  if (!firebaseUser) {
    return (
      <main className="container">
        <section className="card auth-card">
          <h1>Bard's Journal</h1>
          <p>Personal journals with role-based access and admin overview.</p>

          <div className="tabs">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
              type="button"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="form">
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                minLength={6}
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </label>

            <button disabled={isLoading} type="submit">
              {authMode === 'register' ? 'Create account' : 'Login'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (isSessionLoading) {
    return (
      <main className="container" aria-busy="true">
        <section className="card header-card">
          <div className="header-user">
            <div className="header-avatar skeleton skeleton-circle" aria-hidden="true" />
            <div className="header-info">
              <div className="skeleton skeleton-title" aria-hidden="true" />
              <div className="skeleton skeleton-line" aria-hidden="true" />
              <div className="skeleton skeleton-line short" aria-hidden="true" />
            </div>
          </div>
          <div className="header-actions">
            <div className="skeleton skeleton-tabs" aria-hidden="true" />
          </div>
        </section>

        <section className="card">
          <div className="skeleton skeleton-heading" aria-hidden="true" />
          <div className="skeleton skeleton-editor" aria-hidden="true" />
          <div className="skeleton skeleton-button" aria-hidden="true" />
        </section>

        <section className="card">
          <div className="skeleton skeleton-heading" aria-hidden="true" />
          <div className="skeleton-stack" aria-hidden="true">
            <div className="skeleton skeleton-note" />
            <div className="skeleton skeleton-note" />
            <div className="skeleton skeleton-note" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container" aria-busy={isLoading ? 'true' : 'false'}>
      <section className="card header-card">
        <div className="header-user">
          <div className="header-avatar">
            {me?.profileImageUrl ? <img alt={`${me?.username || 'User'} avatar`} src={me.profileImageUrl} /> : '🧙'}
          </div>
          <div className="header-info">
            <h1>Bard's Journal</h1>
            <p>{me?.username || me?.email}</p>
            <p className="hint">{me?.email}</p>
            {me?.role === 'admin' ? <p className="hint">Role: admin</p> : null}
            {greeting ? <p className="hint">{greeting}</p> : null}
          </div>
        </div>

        <div className="header-actions">
          <div className="tabs">
            <button
              className={activeView === 'journal' ? 'active' : ''}
              onClick={() => goToView('journal')}
              type="button"
            >
              Journal
            </button>
            <button
              className={activeView === 'campaigns' ? 'active' : ''}
              onClick={() => goToView('campaigns')}
              type="button"
            >
              Campaigns
            </button>
            <button
              className={activeView === 'profile' ? 'active' : ''}
              onClick={() => goToView('profile')}
              type="button"
            >
              Profile
            </button>
            <button onClick={handleLogout} type="button">
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

      <Routes>
        <Route
          path="/profile"
          element={(
            <section className="card">
              <h2>Profile</h2>
              <form onSubmit={handleProfileSave} className="form">
                <label>
                  Username
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, username: event.target.value }))
                    }
                    required
                    maxLength={50}
                  />
                </label>

                <label>
                  Character Name
                  <input
                    type="text"
                    value={profileForm.characterName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, characterName: event.target.value }))
                    }
                    maxLength={80}
                  />
                </label>

                <label>
                  D&D Beyond Character Sheet URL
                  <input
                    type="url"
                    value={profileForm.dndBeyondUrl}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, dndBeyondUrl: event.target.value }))
                    }
                    placeholder="https://www.dndbeyond.com/characters/..."
                  />
                </label>

                <label>
                  Profile Image URL
                  <input
                    type="url"
                    value={profileForm.profileImageUrl}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, profileImageUrl: event.target.value }))
                    }
                    placeholder="https://example.com/avatar.png"
                  />
                </label>

                <button disabled={isLoading} type="submit">
                  Save profile
                </button>
              </form>
            </section>
          )}
        />

        <Route
          path="/campaigns"
          element={(
            <>
              <section className="card">
                <h2>Join Campaign</h2>
                <form onSubmit={handleJoinCampaign} className="form inline-form">
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
                  <form onSubmit={handleCreateCampaign} className="form inline-form">
                    <input
                      type="text"
                      value={campaignForm.name}
                      onChange={(event) => setCampaignForm({ name: event.target.value })}
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
                      {me?.role === 'admin' ? (
                        <span className="hint">Created: {formatDateTime(campaign.createdAt)}</span>
                      ) : null}
                      <span className="hint">Last updated: {formatDateTime(campaign.updatedAt || campaign.createdAt)}</span>
                      <button
                        disabled={isLoading}
                        onClick={() => navigate(`/journal/${encodeURIComponent(campaign.id)}`)}
                        type="button"
                      >
                        Load campaign journal
                      </button>
                      {me?.role === 'admin' ? (
                        <button
                          className="button-danger"
                          disabled={isLoading}
                          onClick={() => handleDeleteCampaign(campaign)}
                          type="button"
                        >
                          Delete campaign
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        />

        <Route
          path="/journal/*"
          element={(
            <>
              {showInvalidCampaignPage ? (
                <section className="card">
                  <h2>Campaign Not Found</h2>
                  <p className="error">
                    The campaign ID in this URL is invalid or you do not have access to it.
                  </p>
                  <div className="inline-form">
                    <button onClick={() => navigate('/campaigns')} type="button">
                      Go to campaigns
                    </button>
                    <button
                      onClick={() => navigate(selectedCampaignId ? `/journal/${encodeURIComponent(selectedCampaignId)}` : '/journal')}
                      type="button"
                    >
                      Open my journal
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="card">
                    <h2>New Entry</h2>
                    <form onSubmit={handleCreateNote} className="form">
                      <ReactQuill
                        className="editor"
                        theme="snow"
                        value={editorHtml}
                        onChange={setEditorHtml}
                        placeholder={journalPlaceholder}
                      />
                      <button disabled={isLoading || !selectedCampaignId} type="submit">
                        Save note
                      </button>
                    </form>
                  </section>

                  <section className="card">
                    {me?.role === 'admin' ? (
                      <>
                        <h2>Campaign Journal Chat</h2>
                        {visibleNotesByCampaign[0] ? <h3>{visibleNotesByCampaign[0].campaignName}</h3> : null}
                        {adminNotesByDay.length === 0 ? <p>No entries for the selected campaign.</p> : null}
                        <div className="chat-day-list">
                          {adminNotesByDay.map((dayGroup) => (
                            <section className="chat-day-group" key={dayGroup.day}>
                              <div className="chat-day-header">
                                <h4 className="chat-day-heading">
                                  {journalDayLabelByKey.get(`${selectedCampaignId}:${dayGroup.day}`) || formatDayLabel(dayGroup.day)}
                                </h4>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleSetDayGroupTitle(dayGroup.day)}
                                  type="button"
                                >
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
                                        <div className="note-avatar note-avatar-fallback" aria-hidden="true">🧙</div>
                                      )}
                                      <div className="chat-author">
                                        <strong>{note.username || note.userEmail}</strong>
                                        <span>Character: {note.characterName || 'Not set'}</span>
                                      </div>
                                      <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                    ) : (
                      <>
                        <h2>Campaign Journal Entries</h2>
                        {visibleNotesByCampaign.length === 0 ? <p>No entries yet.</p> : null}
                        <div className="notes-group-list">
                          {visibleNotesByCampaign.map((group) => (
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
                    )}
                  </section>
                </>
              )}
            </>
          )}
        />
        <Route path="*" element={<Navigate replace to="/journal" />} />
      </Routes>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
