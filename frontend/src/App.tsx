import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { AuthCard } from './components/AuthCard/AuthCard';
import { AppHeader } from './components/AppHeader/AppHeader';
import { CampaignsView } from './components/CampaignsView/CampaignsView';
import { JournalView } from './components/JournalView/JournalView';
import { ProfileView } from './components/ProfileView/ProfileView';
import { SessionSkeleton } from './components/SessionSkeleton/SessionSkeleton';
import { SessionProvider, useSession } from './context/SessionContext/SessionContext';
import { useQuillA11y } from './hooks/useQuillA11y';

function AppShell() {
  const {
    campaigns,
    error,
    firebaseUser,
    isAuthInitializing,
    isLoading,
    me,
    selectedCampaignId,
    setSelectedCampaignId,
  } = useSession();

  const location = useLocation();
  const navigate = useNavigate();
  const journalMatch = useMatch('/journal/:campaignId');
  const routeCampaignId = (journalMatch?.params?.campaignId || '').trim();

  useQuillA11y([location.pathname]);

  const activeView = useMemo(() => {
    if (location.pathname === '/campaigns') return 'campaigns';
    if (location.pathname === '/profile') return 'profile';
    return 'journal';
  }, [location.pathname]);

  const isJournalRoute = location.pathname.startsWith('/journal');
  const isRouteCampaignValid = Boolean(routeCampaignId) && campaigns.some((campaign) => campaign.id === routeCampaignId);
  const showInvalidCampaignPage = isJournalRoute && Boolean(routeCampaignId) && Boolean(me) && !isLoading && !isRouteCampaignValid;

  useEffect(() => {
    if (!firebaseUser) return;
    if (!(location.pathname.startsWith('/journal') || ['/campaigns', '/profile'].includes(location.pathname))) {
      navigate('/journal', { replace: true });
    }
  }, [firebaseUser, location.pathname, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (!campaigns.length || !routeCampaignId) return;
    if (!campaigns.some((campaign) => campaign.id === routeCampaignId)) return;
    if (routeCampaignId !== selectedCampaignId) {
      setSelectedCampaignId(routeCampaignId);
    }
  }, [campaigns, routeCampaignId, selectedCampaignId, setSelectedCampaignId]);

  useEffect(() => {
    if (!location.pathname.startsWith('/journal')) return;
    if (showInvalidCampaignPage) return;
    if (routeCampaignId && routeCampaignId !== selectedCampaignId) return;

    const expectedPath = selectedCampaignId ? `/journal/${encodeURIComponent(selectedCampaignId)}` : '/journal';
    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true });
    }
  }, [location.pathname, navigate, routeCampaignId, selectedCampaignId, showInvalidCampaignPage]);

  function handleViewNavigation(view: 'journal' | 'campaigns' | 'profile') {
    if (view === 'campaigns') {
      navigate('/campaigns');
      return;
    }
    if (view === 'profile') {
      navigate('/profile');
      return;
    }

    const journalPath = selectedCampaignId ? `/journal/${encodeURIComponent(selectedCampaignId)}` : '/journal';
    navigate(journalPath);
  }

  function goToSelectedJournal() {
    navigate(selectedCampaignId ? `/journal/${encodeURIComponent(selectedCampaignId)}` : '/journal');
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
        <AuthCard errorMessage={error} />
      </main>
    );
  }

  if (isLoading && !me) {
    return <SessionSkeleton />;
  }

  return (
    <main className="container" aria-busy={isLoading ? 'true' : 'false'}>
      <AppHeader activeView={activeView} onNavigateToView={handleViewNavigation} />

      <Routes>
        <Route path="/profile" element={<ProfileView />} />
        <Route
          path="/campaigns"
          element={<CampaignsView onLoadCampaignJournal={(campaignId) => navigate(`/journal/${encodeURIComponent(campaignId)}`)} />}
        />
        <Route
          path="/journal/*"
          element={
            <JournalView
              showInvalidCampaignPage={showInvalidCampaignPage}
              onGoToCampaigns={() => navigate('/campaigns')}
              onGoToJournal={goToSelectedJournal}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/journal" />} />
      </Routes>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
