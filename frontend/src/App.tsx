import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthCard } from './components/AuthCard/AuthCard';
import { AppHeader } from './components/AppHeader/AppHeader';
import { SessionSkeleton } from './components/SessionSkeleton/SessionSkeleton';
import { SessionProvider, useSession } from './context/SessionContext/SessionContext';
import { useQuillA11y } from './hooks/useQuillA11y';
import { AppRoutes } from './routes/AppRoutes/AppRoutes';

function AppShell() {
  const { error, firebaseUser, isAuthInitializing, isLoading, me } = useSession();

  const location = useLocation();

  useQuillA11y([location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

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
      <AppHeader />

      <AppRoutes />

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
