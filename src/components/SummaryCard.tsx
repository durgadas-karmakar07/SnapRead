import { ArrowUpRight, ChevronDown, Play } from "lucide-react";
import type { SummarizeResponse } from "../types/summary";
import { CopyButton } from "./CopyButton";

interface SummaryCardProps {
  data: SummarizeResponse;
  isSample?: boolean;
  onRunSampleLive?: (url: string) => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatPlainSummary(data: SummarizeResponse): string {
  const bullets = data.summary.keyPoints.map((point) => `- ${point}`).join("\n");
  return [
    data.summary.headline,
    `Source: ${data.page.url}`,
    "",
    data.summary.summary,
    "",
    "Key takeaways:",
    bullets,
  ]
    .filter(Boolean)
    .join("\n");
}

export function SummaryCard({
  data,
  isSample = false,
  onRunSampleLive,
}: SummaryCardProps) {
  const { page, summary, meta } = data;
  const plainCopyText = formatPlainSummary(data);

  const briefWordCount =
    countWords(summary.summary) + countWords(summary.keyPoints.join(" "));
  const reductionPct =
    page.wordCount > briefWordCount
      ? Math.round((1 - briefWordCount / page.wordCount) * 100)
      : null;

  return (
    <article className="sheet-card summary-card" aria-labelledby="summary-headline">
      <header className="summary-header">
        <div className="summary-meta-bar">
          <div className="source-meta">
            <span className="site-name">{page.siteName}</span>
            <span className="meta-sep" aria-hidden="true">
              ·
            </span>
            <span>{summary.readingTimeMinutes} min read</span>
            <span className="meta-sep" aria-hidden="true">
              ·
            </span>
            <span>{page.wordCount.toLocaleString()} words</span>
            {reductionPct !== null && reductionPct > 0 ? (
              <>
                <span className="meta-sep" aria-hidden="true">
                  ·
                </span>
                <span className="compression-metric">{reductionPct}% shorter</span>
              </>
            ) : null}
          </div>

          {isSample && onRunSampleLive ? (
            <div className="sample-banner-actions">
              <span className="sample-label">Sample preview</span>
              <button
                type="button"
                className="secondary-btn compact-btn"
                onClick={() => onRunSampleLive(page.url)}
              >
                <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>Run live</span>
              </button>
            </div>
          ) : null}
        </div>

        <h2 id="summary-headline" className="summary-headline">
          {summary.headline}
        </h2>

        <a
          className="source-link"
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>
            {page.title !== page.siteName ? `${page.title} — ` : ""}
            {page.url}
          </span>
          <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </a>
      </header>

      <div className="summary-body">
        <section className="summary-section" aria-labelledby="tldr-heading">
          <h3 id="tldr-heading" className="section-heading">
            Summary
          </h3>
          <div className="summary-prose-wrap">
            <p className="summary-prose">{summary.summary}</p>
          </div>
        </section>

        {summary.keyPoints.length > 0 ? (
          <section className="summary-section" aria-labelledby="takeaways-heading">
            <h3 id="takeaways-heading" className="section-heading">
              Key takeaways
            </h3>
            <ol className="takeaways-list">
              {summary.keyPoints.map((point, index) => (
                <li key={`${index}-${point.slice(0, 24)}`} className="takeaway-row">
                  <span className="takeaway-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="takeaway-text">{point}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {summary.topics.length > 0 ? (
          <section className="summary-section" aria-labelledby="topics-heading">
            <h3 id="topics-heading" className="section-heading">
              Topics
            </h3>
            <ul className="topic-list" role="list">
              {summary.topics.map((topic) => (
                <li key={topic} className="topic-tag">
                  {topic}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="excerpt-details">
          <summary>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              className="excerpt-chevron"
              aria-hidden="true"
            />
            <span>
              Extracted visible text
              {page.truncated ? " (truncated preview)" : ""}
            </span>
          </summary>
          <p className="excerpt-text">{page.excerpt}</p>
        </details>
      </div>

      <footer className="summary-footer">
        <CopyButton text={plainCopyText} />
        <p className="generation-meta">
          {isSample
            ? "Sample brief structure"
            : `${meta.model} · ${(meta.durationMs / 1000).toFixed(1)}s`}
        </p>
      </footer>
    </article>
  );
}
