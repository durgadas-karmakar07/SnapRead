import type { SummarizeResponse } from "../types/summary";
import { CopyButton } from "./CopyButton";

interface SummaryCardProps {
  data: SummarizeResponse;
}

function formatPlainSummary(data: SummarizeResponse): string {
  const bullets = data.summary.keyPoints.map((point) => `- ${point}`).join("\n");
  return [
    data.summary.headline,
    `Source: ${data.page.url}`,
    "",
    data.summary.summary,
    "",
    "Key Takeaways:",
    bullets,
  ]
    .filter(Boolean)
    .join("\n");
}

export function SummaryCard({ data }: SummaryCardProps) {
  const { page, summary, meta } = data;
  const plainCopyText = formatPlainSummary(data);

  return (
    <article className="summary-card" aria-labelledby="summary-headline">
      <header className="summary-header">
        <div className="source-meta">
          <span className="site-badge">{page.siteName}</span>
          <span className="meta-dot" aria-hidden="true">
            ·
          </span>
          <span className="reading-stats">
            {summary.readingTimeMinutes} min read ({page.wordCount.toLocaleString()} words)
          </span>
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
          <span>{page.title !== page.siteName ? `${page.title} — ` : ""}{page.url}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="summary-body">
        {summary.topics.length > 0 ? (
          <ul className="topic-list" role="list" aria-label="Topics">
            {summary.topics.map((topic) => (
              <li key={topic} className="topic-tag">
                {topic}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="summary-section" aria-labelledby="tldr-heading">
          <h3 id="tldr-heading" className="section-heading">
            Summary
          </h3>
          <p className="summary-prose">{summary.summary}</p>
        </section>

        {summary.keyPoints.length > 0 ? (
          <section className="summary-section" aria-labelledby="takeaways-heading">
            <h3 id="takeaways-heading" className="section-heading">
              Key takeaways
            </h3>
            <ul className="takeaways-list">
              {summary.keyPoints.map((point, index) => (
                <li key={`${index}-${point.slice(0, 24)}`}>{point}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="excerpt-details">
          <summary>
            Inspect extracted visible text
            {page.truncated ? " (truncated preview)" : ""}
          </summary>
          <p className="excerpt-text">{page.excerpt}</p>
        </details>
      </div>

      <footer className="summary-footer">
        <CopyButton text={plainCopyText} />
        <p className="generation-meta">
          Summarized with {meta.model} in {(meta.durationMs / 1000).toFixed(1)}s
        </p>
      </footer>
    </article>
  );
}
