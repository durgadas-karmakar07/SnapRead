import { X } from "lucide-react";

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
    <section className="sheet-card loading-card" aria-label="Loading summary">
      <div className="loading-header">
        <progress
          className="loading-spinner"
          aria-label="Fetching webpage content and generating summary"
        />
        <div className="loading-copy">
          <p className="loading-title">Reading {host}</p>
          <p className="loading-subtitle">
            Fetching visible page text and generating brief with Gemini
          </p>
        </div>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Cancel</span>
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
