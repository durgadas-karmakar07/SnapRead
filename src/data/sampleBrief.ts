import type { SummarizeResponse } from "../types/summary";

export interface QuickSource {
  id: string;
  label: string;
  domain: string;
  url: string;
}

export const QUICK_SOURCES: QuickSource[] = [
  {
    id: "mdn-a11y",
    label: "Web Accessibility",
    domain: "developer.mozilla.org",
    url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
  },
  {
    id: "react-learn",
    label: "Quick Start",
    domain: "react.dev",
    url: "https://react.dev/learn",
  },
  {
    id: "wiki-ai",
    label: "Artificial intelligence",
    domain: "en.wikipedia.org",
    url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
  },
];

export const SAMPLE_BRIEF: SummarizeResponse = {
  page: {
    url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
    title: "Accessibility - MDN Web Docs",
    siteName: "MDN Web Docs",
    wordCount: 1640,
    truncated: false,
    excerpt:
      "Accessibility (often abbreviated to A11y) is the practice of making websites usable by as many people as possible, including users with visual, motor, auditory, or cognitive disabilities. Semantic HTML landmarks, descriptive form labels, keyboard navigation support, and sufficient color contrast provide the foundation for accessible web applications.",
  },
  summary: {
    headline: "Web accessibility foundations and semantic HTML practices",
    summary:
      "Web accessibility ensures sites and applications work reliably for people using assistive technologies, keyboards, and varied devices. Building with native semantic HTML elements, clear document landmarks, and sufficient color contrast resolves most barriers before custom ARIA attributes are needed.",
    keyPoints: [
      "Native HTML controls such as buttons, links, and labeled inputs provide built-in keyboard navigation and screen reader semantics.",
      "Logical heading order and landmark elements help assistive technology users scan and jump directly between page sections.",
      "Text and interactive boundaries need clear contrast and visible focus indicators across light, dark, and high-contrast themes.",
    ],
    topics: ["Accessibility", "Semantic HTML", "Web standards"],
    readingTimeMinutes: 7,
  },
  meta: {
    model: "gemini-3.5-flash-lite",
    provider: "gemini",
    durationMs: 1850,
  },
};
