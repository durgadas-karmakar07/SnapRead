import { Bookmark, Clock, FileText } from "lucide-react";
import { QUICK_SOURCES } from "../data/sampleBrief";
import type { SummarizeResponse } from "../types/summary";

interface SidebarProps {
  activeUrl: string;
  isLoading: boolean;
  history: SummarizeResponse[];
  onSelectQuickSource: (url: string) => void;
  onSelectHistory: (item: SummarizeResponse) => void;
}

export function Sidebar({
  activeUrl,
  isLoading,
  history,
  onSelectQuickSource,
  onSelectHistory,
}: SidebarProps) {
  return (
    <aside className="workspace-rail" aria-label="Reading workspace navigation">
      <div className="rail-section">
        <h2 className="rail-heading">Quick sources</h2>
        <ul className="rail-list" role="list">
          {QUICK_SOURCES.map((source) => {
            const isCurrent = activeUrl === source.url;
            return (
              <li key={source.id}>
                <button
                  type="button"
                  className={`rail-item ${isCurrent ? "is-active" : ""}`}
                  disabled={isLoading}
                  onClick={() => onSelectQuickSource(source.url)}
                >
                  <span className="rail-icon" aria-hidden="true">
                    <Bookmark size={16} strokeWidth={1.5} />
                  </span>
                  <span className="rail-item-text">
                    <span className="rail-item-title">{source.label}</span>
                    <span className="rail-item-meta">{source.domain}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rail-section">
        <h2 className="rail-heading">Session briefs</h2>
        {history.length === 0 ? (
          <p className="rail-empty">
            <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Summaries you generate appear here</span>
          </p>
        ) : (
          <ul className="rail-list" role="list">
            {history.map((item) => {
              const isCurrent = activeUrl === item.page.url;
              return (
                <li key={item.page.url}>
                  <button
                    type="button"
                    className={`rail-item ${isCurrent ? "is-active" : ""}`}
                    aria-pressed={isCurrent}
                    onClick={() => onSelectHistory(item)}
                  >
                    <span className="rail-icon" aria-hidden="true">
                      <FileText size={16} strokeWidth={1.5} />
                    </span>
                    <span className="rail-item-text">
                      <span className="rail-item-title">{item.summary.headline}</span>
                      <span className="rail-item-meta">{item.page.siteName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
