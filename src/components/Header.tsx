import { Moon, Sun } from "lucide-react";

interface HeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  modelName: string;
  aiConfigured: boolean | null;
}

export function Header({
  theme,
  onToggleTheme,
  modelName,
  aiConfigured,
}: HeaderProps) {
  const isDark = theme === "dark";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand-cluster">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="14"
                  height="14"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M6.5 7.5h7M6.5 10.5h4.5M6.5 13.5h6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="brand-name">SnapRead</span>
          </div>

          <span className="topbar-divider" aria-hidden="true" />

          <div className="model-status">
            <span
              className={`status-dot ${
                aiConfigured === false ? "is-warning" : "is-ready"
              }`}
              aria-hidden="true"
            />
            <span className="model-name">{modelName}</span>
          </div>
        </div>

        <button
          type="button"
          className="theme-toggle"
          aria-pressed={isDark}
          onClick={onToggleTheme}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>{isDark ? "Light theme" : "Dark theme"}</span>
        </button>
      </div>
    </header>
  );
}
