import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import ReactQuill from 'react-quill';
import { auth } from './firebase';
import { apiRequest } from './api';

const emptyAuthForm = { email: '', password: '' };
const emptyProfileForm = { username: '', characterName: '', dndBeyondUrl: '', profileImageUrl: '' };
const emptyCampaignForm = { name: '' };

export default function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [me, setMe] = useState(null);
  const [notes, setNotes] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [activeView, setActiveView] = useState('journal');
  const [editingNoteId, setEditingNoteId] = useState('');
  const [editNoteHtml, setEditNoteHtml] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [theme, setTheme] = useState('light');
  const [autoJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('join') || '').trim().toUpperCase();
  });

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
      setCampaigns([]);
      setSelectedCampaignId('');
      setAutoJoinAttempted(false);
      return;
    }

    refreshSession();
  }, [firebaseUser]);

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
  }, [activeView, editingNoteId]);

  const greeting = useMemo(() => {
    if (!me) return '';
    return me.role === 'admin' ? 'Admin mode: campaign creation and note editing enabled' : 'User mode';
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
        const [meData, campaignsData, notesData] = await Promise.all([
          apiRequest('/api/me', token),
          apiRequest('/api/campaigns', token),
          apiRequest('/api/notes', token),
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
        setSelectedCampaignId((previous) => {
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

  function startEditNote(note) {
    setEditingNoteId(note.id);
    setEditNoteHtml(note.contentHtml || '');
  }

  function cancelEditNote() {
    setEditingNoteId('');
    setEditNoteHtml('');
  }

  async function handleAdminUpdateNote(noteId) {
    if (!editNoteHtml || editNoteHtml === '<p><br></p>') {
      setError('Note content cannot be empty');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await withToken(async (token) => {
        await apiRequest(`/api/notes/${noteId}`, token, {
          method: 'PUT',
          body: JSON.stringify({ contentHtml: editNoteHtml }),
        });
      });

      cancelEditNote();
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to update note');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }

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

  return (
    <main className="container">
      <section className="card header-card">
        <div className="header-avatar">
          {me?.profileImageUrl ? <img alt={`${me?.username || 'User'} avatar`} src={me.profileImageUrl} /> : '🧙'}
        </div>
        <div className="header-info">
          <h1>Bard's Journal</h1>
          <p>{me?.username || me?.email}</p>
          <p className="hint">{me?.email}</p>
          <p className="hint">Role: {me?.role || 'user'}</p>
          <p className="hint">{greeting}</p>
        </div>

        <div className="header-actions">
          <div className="tabs">
            <button
              className={activeView === 'journal' ? 'active' : ''}
              onClick={() => setActiveView('journal')}
              type="button"
            >
              Journal
            </button>
            <button
              className={activeView === 'campaigns' ? 'active' : ''}
              onClick={() => setActiveView('campaigns')}
              type="button"
            >
              Campaigns
            </button>
            <button
              className={activeView === 'profile' ? 'active' : ''}
              onClick={() => setActiveView('profile')}
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

          <label className="header-campaign">
            Campaign
            <select
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              required
            >
              {campaigns.length === 0 ? <option value="">No campaigns available</option> : null}
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

        </div>
      </section>

      {activeView === 'profile' ? (
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
      ) : null}

      {activeView === 'campaigns' ? (
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
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeView === 'journal' ? (
        <>
          <section className="card">
            <h2>New Entry</h2>
            <form onSubmit={handleCreateNote} className="form">
              <ReactQuill className="editor" theme="snow" value={editorHtml} onChange={setEditorHtml} />
              <button disabled={isLoading || !selectedCampaignId} type="submit">
                Save note
              </button>
            </form>
          </section>

          <section className="card">
            <h2>{me?.role === 'admin' ? 'Journal Entries (Selected Campaign)' : 'Campaign Journal Entries'}</h2>
            {visibleNotesByCampaign.length === 0 ? (
              <p>{me?.role === 'admin' ? 'No entries for the selected campaign.' : 'No entries yet.'}</p>
            ) : null}
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

                        {editingNoteId === note.id ? (
                          <div className="form">
                            <ReactQuill className="editor" theme="snow" value={editNoteHtml} onChange={setEditNoteHtml} />
                            <div className="inline-form">
                              <button disabled={isLoading} onClick={() => handleAdminUpdateNote(note.id)} type="button">
                                Save changes
                              </button>
                              <button disabled={isLoading} onClick={cancelEditNote} type="button">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div dangerouslySetInnerHTML={{ __html: note.contentHtml }} />
                            {me?.role === 'admin' ? (
                              <button onClick={() => startEditNote(note)} type="button">
                                Edit entry
                              </button>
                            ) : null}
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
