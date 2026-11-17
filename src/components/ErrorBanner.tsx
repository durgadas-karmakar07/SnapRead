import { useState } from "react";

interface ErrorBannerProps {
  code: string;
  message: string;
  sessionApiKey: string;
  onSaveSessionApiKey: (key: string) => void;
  onRetry?: () => void;
}

export function ErrorBanner({
  code,
  message,
  sessionApiKey,
  onSaveSessionApiKey,
  onRetry,
}: ErrorBannerProps) {
  const [draftKey, setDraftKey] = useState(sessionApiKey);
  const [showKey, setShowKey] = useState(false);

  const needsApiKey = code === "MISSING_API_KEY" || code === "INVALID_API_KEY";

  function handleKeySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = draftKey.trim();
    if (!cleaned) return;
    onSaveSessionApiKey(cleaned);
  }

  return (
    <section className="status-card error-card" role="alert" aria-labelledby="error-heading">
      <div className="error-header">
        <span className="error-badge" role="img" aria-label="Error">
          !
        </span>
        <div className="error-body">
          <h2 id="error-heading" className="error-title">
            Could not summarize this webpage
          </h2>
          <p className="error-message">{message}</p>
        </div>
      </div>

      {needsApiKey ? (
        <form className="key-setup-box" onSubmit={handleKeySubmit}>
          <p className="key-setup-note">
            Set <code>GEMINI_API_KEY</code> in your project <code>.env</code> file and restart the
            server, or paste a Gemini API key below for this browser session only:
          </p>
          <div className="key-input-row">
            <label htmlFor="session-api-key" className="visually-hidden">
              Temporary Gemini API key
            </label>
            <input
              id="session-api-key"
              name="sessionApiKey"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste Gemini API key"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
            />
            <button
              type="button"
              className="secondary-btn"
              aria-pressed={showKey}
              onClick={() => setShowKey((prev) => !prev)}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button type="submit" className="primary-btn">
              Apply &amp; Retry
            </button>
          </div>
        </form>
      ) : onRetry ? (
        <div className="error-actions">
          <button type="button" className="secondary-btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
