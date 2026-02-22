import type { SessionSkeletonProps } from './types';

export function SessionSkeleton({ title = "Bard's Journal" }: SessionSkeletonProps) {
  return (
    <main className="container app-shell" aria-busy="true">
      <header className="top-nav" aria-label={`${title} loading navigation`}>
        <div className="skeleton skeleton-nav-brand" aria-hidden="true" />
        <div className="skeleton skeleton-nav-tabs" aria-hidden="true" />
        <div className="skeleton-nav-actions" aria-hidden="true">
          <div className="skeleton skeleton-nav-button" />
          <div className="skeleton skeleton-nav-icon" />
          <div className="skeleton skeleton-nav-user" />
        </div>
      </header>

      <div className="app-content">
        <section className="card journal-chat-card">
          <div className="journal-chat-messages">
            <div className="skeleton skeleton-heading compact" aria-hidden="true" />
            <div className="skeleton-stack" aria-hidden="true">
              <div className="skeleton skeleton-day-label" />
              <div className="skeleton skeleton-note compact" />
              <div className="skeleton skeleton-note compact" />
              <div className="skeleton skeleton-day-label" />
              <div className="skeleton skeleton-note compact" />
              <div className="skeleton skeleton-note compact" />
            </div>
          </div>

          <div className="journal-chat-composer" aria-label={`${title} loading composer`}>
            <div className="skeleton-composer-row" aria-hidden="true">
              <div className="skeleton skeleton-toggle" />
              <div className="skeleton skeleton-line short" />
            </div>
            <div className="skeleton skeleton-editor compact" aria-hidden="true" />
            <div className="skeleton skeleton-button" aria-hidden="true" />
          </div>
        </section>
      </div>
    </main>
  );
}
