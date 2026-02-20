import type { SessionSkeletonProps } from './types';

export function SessionSkeleton({ title = "Bard's Journal" }: SessionSkeletonProps) {
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
        <h1>{title}</h1>
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
