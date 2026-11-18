import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { Header } from "./components/Header";
import { LoadingCard } from "./components/LoadingCard";
import { Sidebar } from "./components/Sidebar";
import { SummaryCard } from "./components/SummaryCard";
import { UrlForm } from "./components/UrlForm";
import { SAMPLE_BRIEF } from "./data/sampleBrief";
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
        // Health check failure is non-blocking; /api/summarize surfaces live API errors.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.title = summary
      ? `${summary.summary.headline} — SnapRead`
      : "SnapRead — Webpage Summariser";
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
        return [result, ...filtered].slice(0, 6);
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
  const activeBrief = summary ?? SAMPLE_BRIEF;
  const isShowingSample = summary === null;
  const activeUrl = isLoading ? currentUrl : summary?.page.url ?? "";

  return (
    <div className="app-shell">
      <a href="#main-heading" className="skip-link visually-hidden">
        Skip to content
      </a>

      <Header
        theme={activeTheme}
        onToggleTheme={handleToggleTheme}
        modelName={health?.model || "gemini-3.5-flash-lite"}
        aiConfigured={health?.aiConfigured ?? null}
      />

      <div className="workspace-grid">
        <Sidebar
          activeUrl={activeUrl}
          isLoading={isLoading}
          history={history}
          onSelectQuickSource={(url) => void runSummarize(url)}
          onSelectHistory={(item) => {
            setError(null);
            setSummary(item);
            setCurrentUrl(item.page.url);
          }}
        />

        <main className="main-content">
          <section className="workspace-header">
            <h1 id="main-heading" tabIndex={-1} className="page-title">
              Webpage brief
            </h1>
            <p className="page-subtitle">
              Fetch visible text from any public URL and distill it into a structured brief with Gemini
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
                No <code>GEMINI_API_KEY</code> on the server, so briefs use the built-in offline
                summariser.{" "}
                <button
                  type="button"
                  className="inline-link-btn"
                  aria-expanded={showKeyDrawer}
                  aria-controls="quick-key-drawer"
                  onClick={() => setShowKeyDrawer((prev) => !prev)}
                >
                  {showKeyDrawer ? "Hide session key input" : "Use a Gemini key for this session"}
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
                    {showDraftKey ? (
                      <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
                    )}
                    <span>{showDraftKey ? "Hide" : "Show"}</span>
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

          {!isLoading && !error ? (
            <SummaryCard
              data={activeBrief}
              isSample={isShowingSample}
              onRunSampleLive={(url) => void runSummarize(url)}
            />
          ) : null}
        </main>
      </div>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>SnapRead extracts visible webpage text server-side and summarizes with Gemini</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
