import { Check, Copy } from "lucide-react";
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

export function CopyButton({ text, label = "Copy brief" }: CopyButtonProps) {
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
        className="secondary-btn copy-button"
        data-copied={state === "copied" ? "" : undefined}
        data-failed={state === "failed" ? "" : undefined}
        onClick={handleCopy}
      >
        <span className="copy-icon" aria-hidden="true">
          {state === "copied" ? (
            <Check size={16} strokeWidth={1.5} />
          ) : (
            <Copy size={16} strokeWidth={1.5} />
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
