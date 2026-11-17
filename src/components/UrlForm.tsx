import { AlertCircle, ArrowRight, Globe, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface UrlFormProps {
  initialUrl?: string;
  isLoading: boolean;
  onSubmitUrl: (normalizedUrl: string) => void;
}

function normalizeCandidateUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function validatePublicUrl(raw: string): { valid: boolean; normalized: string; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: "",
      error: "Enter a webpage URL to summarize (for example, https://react.dev/learn).",
    };
  }

  const normalized = normalizeCandidateUrl(trimmed);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      valid: false,
      normalized,
      error: "Enter a valid web address with a domain like react.dev/learn.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      normalized,
      error: "Only public http:// and https:// web addresses are supported.",
    };
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return {
      valid: false,
      normalized,
      error: "Enter a full public domain name (for example, https://react.dev/learn).",
    };
  }

  return { valid: true, normalized: parsed.toString(), error: "" };
}

export function UrlForm({ initialUrl = "", isLoading, onSubmitUrl }: UrlFormProps) {
  const [value, setValue] = useState(initialUrl);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const announceTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setValue(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(announceTimerRef.current);
    };
  }, []);

  const showError = hasInteracted && Boolean(validationError);
  const describedBy = showError ? "url-hint url-error" : "url-hint";

  function schedulePoliteAnnouncement(message: string) {
    window.clearTimeout(announceTimerRef.current);
    setLiveAnnouncement("");
    if (!message) return;
    announceTimerRef.current = window.setTimeout(() => {
      setLiveAnnouncement(`Source URL: ${message}`);
    }, 350);
  }

  function handleChange(nextValue: string) {
    setValue(nextValue);
    inputRef.current?.setCustomValidity("");

    if (showError) {
      const check = validatePublicUrl(nextValue);
      if (check.valid || !nextValue.trim()) {
        setValidationError("");
        schedulePoliteAnnouncement("");
      }
    }
  }

  function handleBlur() {
    if (!value.trim() && !hasInteracted) {
      return;
    }

    setHasInteracted(true);
    const check = validatePublicUrl(value);
    if (check.valid) {
      if (check.normalized !== value) {
        setValue(check.normalized);
      }
      inputRef.current?.setCustomValidity("");
      setValidationError("");
      schedulePoliteAnnouncement("");
    } else {
      inputRef.current?.setCustomValidity(check.error);
      setValidationError(check.error);
      schedulePoliteAnnouncement(check.error);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setHasInteracted(true);
    const check = validatePublicUrl(value);

    if (!check.valid) {
      inputRef.current?.setCustomValidity(check.error);
      setValidationError(check.error);
      window.clearTimeout(announceTimerRef.current);
      setLiveAnnouncement("");
      inputRef.current?.focus();
      return;
    }

    inputRef.current?.setCustomValidity("");
    setValidationError("");
    schedulePoliteAnnouncement("");
    setValue(check.normalized);
    onSubmitUrl(check.normalized);
  }

  function handleClear() {
    setValue("");
    setHasInteracted(false);
    setValidationError("");
    setLiveAnnouncement("");
    inputRef.current?.setCustomValidity("");
    inputRef.current?.focus();
  }

  return (
    <section className="command-card" aria-labelledby="url-form-heading">
      <h2 id="url-form-heading" className="visually-hidden">
        Summarize a webpage by URL
      </h2>

      <form className="url-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <div className="field-header-row">
            <label htmlFor="url-input" className="field-label">
              Source URL <span aria-hidden="true">*</span>
            </label>
            <span id="url-hint" className="field-hint">
              Any public http:// or https:// webpage
            </span>
          </div>

          <div className="input-row">
            <div className={`input-shell ${showError ? "is-invalid" : ""}`}>
              <span className="input-leading-icon" aria-hidden="true">
                <Globe size={16} strokeWidth={1.5} />
              </span>
              <input
                ref={inputRef}
                id="url-input"
                name="url"
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                required
                placeholder="https://example.com/article"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                aria-invalid={showError ? "true" : "false"}
                aria-describedby={describedBy}
              />
              {value.length > 0 && !isLoading ? (
                <button
                  type="button"
                  className="clear-input-btn"
                  aria-label="Clear URL"
                  onClick={handleClear}
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              ) : (
                <kbd className="shortcut-keycap" aria-hidden="true">
                  /
                </kbd>
              )}
            </div>

            <button
              type="submit"
              className="primary-btn"
              disabled={isLoading}
            >
              <span>{isLoading ? "Summarizing" : "Summarize"}</span>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <div id="url-error" className="field-error" hidden={!showError}>
            <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        </div>
      </form>

      <div className="visually-hidden" aria-live="polite">
        {liveAnnouncement}
      </div>
    </section>
  );
}
