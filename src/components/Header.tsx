interface HeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  modelName: string;
}

export function Header({ theme, onToggleTheme, modelName }: HeaderProps) {
  const isDark = theme === "dark";

  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
            <circle cx="18.5" cy="12" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="brand-name">SnapRead</span>
        <span className="model-pill" title={`Using Gemini model ${modelName}`}>
          {modelName}
        </span>
      </div>

      <button
        type="button"
        className="theme-toggle"
        aria-pressed={isDark}
        onClick={onToggleTheme}
      >
        <span className="theme-icon" aria-hidden="true">
          {isDark ? "☀" : "☾"}
        </span>
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      </button>
    </header>
  );
}
