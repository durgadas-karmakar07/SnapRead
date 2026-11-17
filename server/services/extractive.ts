import type { PageContent, SummaryResult } from "../types/summary.js";

const STOP_WORDS = new Set([
  "about", "above", "after", "again", "against", "all", "also", "am", "an", "and",
  "any", "are", "aren", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "however", "if", "in", "into", "is", "isn", "it", "its",
  "itself", "just", "like", "make", "many", "may", "me", "might", "more", "most",
  "must", "my", "myself", "need", "no", "nor", "not", "now", "of", "off", "on",
  "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
  "page", "same", "see", "she", "should", "since", "so", "some", "such", "take",
  "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "use", "used", "using", "very", "want", "was", "way", "we", "well", "were",
  "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "within", "without", "would", "you", "your", "yours", "yourself", "yourselves",
]);

const NOISE_PATTERNS = [
  /^skip to (main )?content$/i,
  /^copy( page)?$/i,
  /^cookie(s)? (policy|settings|preferences)/i,
  /^accept (all )?cookies/i,
  /^all rights reserved/i,
  /^terms of (service|use)/i,
  /^privacy policy$/i,
  /^sign (in|up)|log in$/i,
  /^subscribe to/i,
  /^share (this|on)/i,
];

function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter(
    (word) => !STOP_WORDS.has(word)
  );
}

function cleanHeadline(rawTitle: string, siteName: string): string {
  const cleaned = rawTitle
    .replace(/\s+/g, " ")
    .replace(/\s*[|\-–—]\s*[^|\-–—]{1,35}$/, (suffix) => {
      const lower = suffix.toLowerCase();
      const siteLower = siteName.toLowerCase().replace(/\.[a-z]+$/, "");
      if (
        lower.includes(siteLower) ||
        lower.includes("wikipedia") ||
        lower.includes("mdn") ||
        lower.includes("home") ||
        lower.includes("official")
      ) {
        return "";
      }
      return suffix;
    })
    .trim();

  return cleaned.length >= 6 ? cleaned : rawTitle.trim() || "Webpage Summary";
}

function extractCandidateSentences(page: PageContent): string[] {
  const rawBlocks = page.visibleText
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 35);

  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushSentence = (raw: string) => {
    const text = raw
      .replace(/\[[0-9]+\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 42 || text.length > 320) return;
    if (text.endsWith("?") || text.endsWith(":")) return;
    if (NOISE_PATTERNS.some((re) => re.test(text))) return;

    // Skip lines that look like menus or breadcrumb lists
    const pipeCount = (text.match(/[|›»/]/g) ?? []).length;
    if (pipeCount >= 3) return;

    const words = text.split(/\s+/);
    if (words.length < 7 || words.length > 52) return;

    const fingerprint = text.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);

    const normalizedEnd = /[.!?]$/.test(text) ? text : `${text}.`;
    candidates.push(normalizedEnd);
  };

  if (page.description && page.description.length >= 45) {
    pushSentence(page.description);
  }

  for (const block of rawBlocks) {
    const parts = block.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/);
    for (const part of parts) {
      pushSentence(part);
      if (candidates.length >= 120) break;
    }
    if (candidates.length >= 120) break;
  }

  return candidates;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function extractTopTopics(page: PageContent, freq: Map<string, number>): string[] {
  const titleWords = (
    `${page.title} ${page.description}`.match(/\b[A-Z][a-zA-Z0-9+#-]{2,}(?:\s+[A-Z][a-zA-Z0-9+#-]{2,})?\b/g) ?? []
  )
    .map((phrase) => phrase.trim())
    .filter((phrase) => {
      const words = phrase.split(/\s+/);
      return (
        words.every((w) => !STOP_WORDS.has(w.toLowerCase())) &&
        phrase.toLowerCase() !== page.siteName.toLowerCase() &&
        phrase.length <= 26
      );
    });

  const topics: string[] = [];
  const seenLower = new Set<string>();

  for (const phrase of titleWords) {
    const key = phrase.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      topics.push(phrase);
      if (topics.length >= 4) return topics;
    }
  }

  const sortedTerms = [...freq.entries()]
    .filter(([word]) => word.length >= 4 && !seenLower.has(word))
    .sort((a, b) => b[1] - a[1]);

  for (const [word] of sortedTerms) {
    const formatted = word.charAt(0).toUpperCase() + word.slice(1);
    topics.push(formatted);
    seenLower.add(word);
    if (topics.length >= 4) break;
  }

  return topics.length > 0 ? topics : ["Web article"];
}

export function summarizeWithExtractiveNlp(page: PageContent): SummaryResult {
  const headline = cleanHeadline(page.title, page.siteName);
  const readingTimeMinutes = Math.max(1, Math.round(page.wordCount / 220));
  const sentences = extractCandidateSentences(page);

  if (sentences.length === 0) {
    const fallbackSentence =
      page.description.trim() ||
      page.visibleText.replace(/\s+/g, " ").trim().slice(0, 260);
    return {
      headline,
      summary: fallbackSentence.endsWith(".")
        ? fallbackSentence
        : `${fallbackSentence}.`,
      keyPoints: [
        `Source domain: ${page.siteName}.`,
        `Extracted ${page.wordCount.toLocaleString()} words of visible text.`,
      ],
      topics: [page.siteName],
      readingTimeMinutes,
    };
  }

  const freq = new Map<string, number>();
  const titleTokens = new Set(tokenizeWords(`${page.title} ${page.description}`));

  for (const token of tokenizeWords(page.visibleText)) {
    const boost = titleTokens.has(token) ? 2.4 : 1;
    freq.set(token, (freq.get(token) ?? 0) + boost);
  }

  const scored = sentences.map((text, index) => {
    const tokens = tokenizeWords(text);
    const tokenSet = new Set(tokens);
    let rawScore = 0;
    for (const token of tokenSet) {
      rawScore += freq.get(token) ?? 0;
    }

    const lengthNorm = Math.pow(Math.max(tokens.length, 6), 0.65);
    const positionBonus = index === 0 ? 1.35 : index < 5 ? 1.2 : index < 15 ? 1.08 : 1;
    const score = (rawScore / lengthNorm) * positionBonus;

    return { text, index, score, tokenSet };
  });

  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const selected: typeof scored = [];

  for (const candidate of byScore) {
    const tooSimilar = selected.some(
      (existing) => jaccardSimilarity(existing.tokenSet, candidate.tokenSet) > 0.5
    );
    if (!tooSimilar) {
      selected.push(candidate);
    }
    if (selected.length >= 6) break;
  }

  const summarySentences = selected
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text);

  const takeawaySentences = selected
    .slice(2, 6)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text);

  const keyPoints =
    takeawaySentences.length > 0
      ? takeawaySentences
      : selected.slice(0, 3).map((item) => item.text);

  return {
    headline,
    summary: summarySentences.join(" "),
    keyPoints,
    topics: extractTopTopics(page, freq),
    readingTimeMinutes,
  };
}
