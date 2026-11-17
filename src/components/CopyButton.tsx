import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

export function CopyButton({ text, label = "Copy summary" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const lastMessageRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (!text) return;
    window.clearTimeout(timerRef.current);
    setStatusMessage("");

    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }

    let message = ok ? "Copied" : "Copy failed";
    if (message === lastMessageRef.current) {
      // Prevent VoiceOver from skipping identical repeated live-region messages.
      message += "\u00A0";
    }
    lastMessageRef.current = message;

    setState(ok ? "copied" : "failed");
    requestAnimationFrame(() => {
      setStatusMessage(message);
    });

    timerRef.current = window.setTimeout(() => {
      setState("idle");
      setStatusMessage("");
    }, 2000);
  }

  return (
    <span className="copy-wrap">
      <button
        type="button"
        className="copy-button"
        data-copied={state === "copied" ? "" : undefined}
        data-failed={state === "failed" ? "" : undefined}
        onClick={handleCopy}
      >
        <span className="copy-icon" aria-hidden="true">
          {state === "copied" ? (
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="7" y="7" width="9" height="10" rx="2" />
              <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
          )}
        </span>
        <span>{label}</span>
      </button>
      <span className="copy-tip" role="status">
        {statusMessage}
      </span>
    </span>
  );
}
