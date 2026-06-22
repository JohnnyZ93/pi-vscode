/**
 * Session search utilities.
 *
 * Ported from `@earendil-works/pi-coding-agent`'s internal
 * `dist/modes/interactive/components/session-selector-search.js` and
 * `@earendil-works/pi-tui` `fuzzy.ts`. The SDK only exports those via
 * `package.json#exports = { "." }`, so we cannot import them directly.
 * Keeping a small local copy preserves identical search semantics
 * (fuzzy tokens, "quoted phrase", `re:pattern`) without leaning on
 * SDK internals.
 */

import type { SessionInfo } from "@earendil-works/pi-coding-agent";

export interface FuzzyMatch {
  matches: boolean;
  score: number;
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  const matchQuery = (normalizedQuery: string): FuzzyMatch => {
    if (normalizedQuery.length === 0) return { matches: true, score: 0 };
    if (normalizedQuery.length > textLower.length) return { matches: false, score: 0 };

    let queryIndex = 0;
    let score = 0;
    let lastMatchIndex = -1;
    let consecutiveMatches = 0;

    for (let i = 0; i < textLower.length && queryIndex < normalizedQuery.length; i++) {
      if (textLower[i] === normalizedQuery[queryIndex]) {
        const isWordBoundary = i === 0 || /[\s\-_./:]/.test(textLower[i - 1]!);
        if (lastMatchIndex === i - 1) {
          consecutiveMatches++;
          score -= consecutiveMatches * 5;
        } else {
          consecutiveMatches = 0;
          if (lastMatchIndex >= 0) {
            score += (i - lastMatchIndex - 1) * 2;
          }
        }
        if (isWordBoundary) score -= 10;
        score += i * 0.1;
        lastMatchIndex = i;
        queryIndex++;
      }
    }

    if (queryIndex < normalizedQuery.length) return { matches: false, score: 0 };
    if (normalizedQuery === textLower) score -= 100;
    return { matches: true, score };
  };

  const primary = matchQuery(queryLower);
  if (primary.matches) return primary;

  const alphaNum = queryLower.match(/^(?<letters>[a-z]+)(?<digits>[0-9]+)$/);
  const numAlpha = queryLower.match(/^(?<digits>[0-9]+)(?<letters>[a-z]+)$/);
  const swapped = alphaNum
    ? `${alphaNum.groups?.digits ?? ""}${alphaNum.groups?.letters ?? ""}`
    : numAlpha
      ? `${numAlpha.groups?.letters ?? ""}${numAlpha.groups?.digits ?? ""}`
      : "";

  if (!swapped) return primary;
  const swappedMatch = matchQuery(swapped);
  if (!swappedMatch.matches) return primary;
  return { matches: true, score: swappedMatch.score + 5 };
}

interface ParsedToken {
  kind: "fuzzy" | "phrase";
  value: string;
}

export interface ParsedSearchQuery {
  mode: "tokens" | "regex";
  tokens: ParsedToken[];
  regex: RegExp | null;
  error?: string;
}

function normalizeWhitespaceLower(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function getSessionSearchText(session: SessionInfo): string {
  return `${session.id} ${session.name ?? ""} ${session.allMessagesText} ${session.cwd}`;
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  if (!trimmed) return { mode: "tokens", tokens: [], regex: null };

  if (trimmed.startsWith("re:")) {
    const pattern = trimmed.slice(3).trim();
    if (!pattern) return { mode: "regex", tokens: [], regex: null, error: "Empty regex" };
    try {
      return { mode: "regex", tokens: [], regex: new RegExp(pattern, "i") };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { mode: "regex", tokens: [], regex: null, error: msg };
    }
  }

  const tokens: ParsedToken[] = [];
  let buf = "";
  let inQuote = false;
  let hadUnclosedQuote = false;
  const flush = (kind: ParsedToken["kind"]) => {
    const v = buf.trim();
    buf = "";
    if (!v) return;
    tokens.push({ kind, value: v });
  };

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === '"') {
      if (inQuote) {
        flush("phrase");
        inQuote = false;
      } else {
        flush("fuzzy");
        inQuote = true;
      }
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      flush("fuzzy");
      continue;
    }
    buf += ch;
  }
  if (inQuote) hadUnclosedQuote = true;

  if (hadUnclosedQuote) {
    return {
      mode: "tokens",
      tokens: trimmed
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => ({ kind: "fuzzy", value: t })),
      regex: null,
    };
  }
  flush(inQuote ? "phrase" : "fuzzy");
  return { mode: "tokens", tokens, regex: null };
}

interface MatchResult {
  matches: boolean;
  score: number;
}

export function matchSession(session: SessionInfo, parsed: ParsedSearchQuery): MatchResult {
  const text = getSessionSearchText(session);

  if (parsed.mode === "regex") {
    if (!parsed.regex) return { matches: false, score: 0 };
    const idx = text.search(parsed.regex);
    if (idx < 0) return { matches: false, score: 0 };
    return { matches: true, score: idx * 0.1 };
  }

  if (parsed.tokens.length === 0) return { matches: true, score: 0 };

  let totalScore = 0;
  let normalizedText: string | null = null;
  for (const token of parsed.tokens) {
    if (token.kind === "phrase") {
      if (normalizedText === null) normalizedText = normalizeWhitespaceLower(text);
      const phrase = normalizeWhitespaceLower(token.value);
      if (!phrase) continue;
      const idx = normalizedText.indexOf(phrase);
      if (idx < 0) return { matches: false, score: 0 };
      totalScore += idx * 0.1;
      continue;
    }
    const m = fuzzyMatch(token.value, text);
    if (!m.matches) return { matches: false, score: 0 };
    totalScore += m.score;
  }
  return { matches: true, score: totalScore };
}

export type SortMode = "recent" | "relevance";

export interface FilterResult {
  sessions: SessionInfo[];
  error?: string;
}

/**
 * Filter sessions by query and sort by mode.
 * - Empty query: returns input untouched (caller should pre-sort by modified desc).
 * - Regex error: returns `{ sessions: [], error }`.
 * - "recent" mode: keep input order among matches.
 * - "relevance" mode: sort by score asc, tie-break by modified desc.
 */
export function filterAndSortSessions(
  sessions: SessionInfo[],
  query: string,
  sortMode: SortMode,
): FilterResult {
  const trimmed = query.trim();
  if (!trimmed) return { sessions };

  const parsed = parseSearchQuery(query);
  if (parsed.error) return { sessions: [], error: parsed.error };

  if (sortMode === "recent") {
    const filtered: SessionInfo[] = [];
    for (const s of sessions) {
      const res = matchSession(s, parsed);
      if (res.matches) filtered.push(s);
    }
    return { sessions: filtered };
  }

  const scored: { session: SessionInfo; score: number }[] = [];
  for (const s of sessions) {
    const res = matchSession(s, parsed);
    if (!res.matches) continue;
    scored.push({ session: s, score: res.score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const am = a.session.modified instanceof Date ? a.session.modified.getTime() : 0;
    const bm = b.session.modified instanceof Date ? b.session.modified.getTime() : 0;
    return bm - am;
  });
  return { sessions: scored.map((r) => r.session) };
}
