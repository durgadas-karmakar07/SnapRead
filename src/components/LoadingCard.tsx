interface LoadingCardProps {
  targetUrl: string;
  onCancel: () => void;
}

function getDisplayHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

export function LoadingCard({ targetUrl, onCancel }: LoadingCardProps) {
  const host = getDisplayHost(targetUrl);

  return (
    <section className="status-card loading-card" aria-label="Loading summary">
      <div className="loading-header">
        <progress
          className="loading-spinner"
          aria-label="Fetching webpage content and generating summary"
        />
        <div className="loading-copy">
          <p className="loading-title">Summarizing {host}</p>
          <p className="loading-subtitle">
            Fetching visible page text and generating a concise brief with Gemini…
          </p>
        </div>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="skeleton-stack" aria-hidden="true">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    </section>
  );
}
