import { useEffect, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { Header } from "./components/Header";
import { LoadingCard } from "./components/LoadingCard";
import { SummaryCard } from "./components/SummaryCard";
import { UrlForm } from "./components/UrlForm";
import { ApiClientError, fetchHealth, summarizeUrl } from "./services/api";
import type { HealthResponse, SummarizeResponse } from "./types/summary";

interface ErrorState {
  code: string;
  message: string;
  targetUrl: string;
}

export function App() {
  const [themeOverride, setThemeOverride] = useState<"light" | "dark" | null>(null);
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sessionApiKey, setSessionApiKey] = useState("");
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [showDraftKey, setShowDraftKey] = useState(false);

  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);
  const [history, setHistory] = useState<SummarizeResponse[]>([]);
  const [error, setError] = useState<ErrorState | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const activeTheme: "light" | "dark" = themeOverride ?? (systemDark ? "dark" : "light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeOverride) {
      root.style.colorScheme = themeOverride;
      root.dataset.theme = themeOverride;
    } else {
      root.style.colorScheme = "light dark";
      delete root.dataset.theme;
    }
  }, [themeOverride]);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((data) => setHealth(data))
      .catch(() => {
        // Health check failure is non-blocking; /api/summarize will surface real errors if backend is offline.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.title = summary
      ? `${summary.summary.headline} — SnapRead`
      : "SnapRead — AI Website Summariser";
  }, [summary]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function runSummarize(targetUrl: string, overrideKey?: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCurrentUrl(targetUrl);
    setIsLoading(true);
    setError(null);

    try {
      const result = await summarizeUrl(targetUrl, {
        signal: controller.signal,
        sessionApiKey: overrideKey ?? sessionApiKey,
      });

      setSummary(result);
      setHistory((prev) => {
        const filtered = prev.filter((item) => item.page.url !== result.page.url);
        return [result, ...filtered].slice(0, 5);
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      if (err instanceof ApiClientError) {
        setError({
          code: err.code,
          message: err.message,
          targetUrl,
        });
      } else {
        setError({
          code: "UNKNOWN_ERROR",
          message: "Something went wrong while summarizing that page.",
          targetUrl,
        });
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  function handleToggleTheme() {
    setThemeOverride((prev) => {
      const current = prev ?? (systemDark ? "dark" : "light");
      return current === "dark" ? "light" : "dark";
    });
  }

  function handleApplySessionKey(nextKey: string) {
    setSessionApiKey(nextKey);
    setShowKeyDrawer(false);
    if (error?.targetUrl) {
      void runSummarize(error.targetUrl, nextKey);
    }
  }

  const keyMissingOnServer = health !== null && !health.aiConfigured && !sessionApiKey;

  return (
    <div className="app-shell">
      <a href="#main-heading" className="skip-link visually-hidden">
        Skip to content
      </a>

      <Header
        theme={activeTheme}
        onToggleTheme={handleToggleTheme}
        modelName={health?.model || "gemini-3.5-flash-lite"}
      />

      <main className="main-content">
        <section className="hero">
          <h1 id="main-heading" tabIndex={-1} className="hero-title">
            Turn any public webpage into a crisp brief.
          </h1>
          <p className="hero-subtitle">
            Paste a link below. SnapRead extracts the visible text and uses Gemini to distill the
            core message and key takeaways.
          </p>
        </section>

        <UrlForm
          initialUrl={currentUrl}
          isLoading={isLoading}
          onSubmitUrl={(url) => void runSummarize(url)}
        />

        {keyMissingOnServer && !error ? (
          <div className="setup-hint-bar">
            <p className="setup-hint-text">
              <code>GEMINI_API_KEY</code> is not set in <code>.env</code> yet.{" "}
              <button
                type="button"
                className="inline-link-btn"
                aria-expanded={showKeyDrawer}
                aria-controls="quick-key-drawer"
                onClick={() => setShowKeyDrawer((prev) => !prev)}
              >
                {showKeyDrawer ? "Hide session key input" : "Use a temporary session key"}
              </button>
            </p>
            {showKeyDrawer ? (
              <form
                id="quick-key-drawer"
                className="quick-key-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draftKey.trim()) {
                    setSessionApiKey(draftKey.trim());
                    setShowKeyDrawer(false);
                  }
                }}
              >
                <label htmlFor="header-session-key" className="visually-hidden">
                  Temporary Gemini API key
                </label>
                <input
                  id="header-session-key"
                  type={showDraftKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste Gemini API key (session only)"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  aria-pressed={showDraftKey}
                  onClick={() => setShowDraftKey((prev) => !prev)}
                >
                  {showDraftKey ? "Hide" : "Show"}
                </button>
                <button type="submit" className="primary-btn">
                  Save for session
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingCard targetUrl={currentUrl} onCancel={handleCancel} />
        ) : null}

        {!isLoading && error ? (
          <ErrorBanner
            code={error.code}
            message={error.message}
            sessionApiKey={sessionApiKey}
            onSaveSessionApiKey={handleApplySessionKey}
            onRetry={
              error.targetUrl ? () => void runSummarize(error.targetUrl) : undefined
            }
          />
        ) : null}

        {!isLoading && !error && summary ? <SummaryCard data={summary} /> : null}

        {history.length > 1 ? (
          <section className="history-strip" aria-labelledby="history-heading">
            <h2 id="history-heading" className="history-heading">
              Recent in this session
            </h2>
            <ul className="history-list" role="list">
              {history.map((item) => {
                const isActive = summary?.page.url === item.page.url;
                return (
                  <li key={item.page.url}>
                    <button
                      type="button"
                      className={`history-chip ${isActive ? "is-active" : ""}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setError(null);
                        setSummary(item);
                        setCurrentUrl(item.page.url);
                      }}
                    >
                      <span className="history-site">{item.page.siteName}</span>
                      <span className="history-title">{item.summary.headline}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="site-footer">
        <p>SnapRead fetches visible webpage text server-side and summarizes with Gemini.</p>
      </footer>
    </div>
  );
}

export default App;
