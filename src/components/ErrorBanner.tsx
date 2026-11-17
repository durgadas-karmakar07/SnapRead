import { AlertCircle, Eye, EyeOff, RotateCcw } from "lucide-react";
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
    <section className="sheet-card error-card" role="alert" aria-labelledby="error-heading">
      <div className="error-header">
        <span className="error-icon" aria-hidden="true">
          <AlertCircle size={18} strokeWidth={1.5} />
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
            {code === "INVALID_API_KEY"
              ? "Update GEMINI_API_KEY in your hosting environment variables (e.g. Netlify) or local .env with a fresh Google AI Studio key, or paste a working key below for this browser session:"
              : "Set GEMINI_API_KEY in your hosting environment variables (e.g. Netlify) or local .env, or paste a Gemini API key below for this browser session only:"}
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
              {showKey ? (
                <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
              <span>{showKey ? "Hide" : "Show"}</span>
            </button>
            <button type="submit" className="primary-btn">
              Apply &amp; retry
            </button>
          </div>
        </form>
      ) : onRetry ? (
        <div className="error-actions">
          <button type="button" className="secondary-btn" onClick={onRetry}>
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
