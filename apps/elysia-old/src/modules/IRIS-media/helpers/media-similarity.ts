import { t } from "elysia"

export const SIMILAR_MEDIA_TTL = 5 * 60 // 5 minutes
export const MIN_SIMILARITY_SCORE = 17 // Minimum score threshold
export const TITLE_MATCH_THRESHOLD = 0.6 // 60% match required
export const TITLE_MATCH_POINTS = 20
export const HASHTAG_MATCH_POINTS = 10
export const GENRE_MATCH_POINTS = 1
export const CHARACTER_MATCH_POINTS = 0.5

export const SimilarMediaTitlesSchema = t.Object({
  primary: t.String(),
  secondary: t.Nullable(t.String()),
  native: t.Nullable(t.String()),
})

export const SimilarMediaItemSchema = t.Object({
  id: t.Number(),
  type: t.String(),
  format: t.String(),
  coverImage: t.Nullable(t.String()),
  titles: SimilarMediaTitlesSchema,
})

export const SimilarMediaResponseSchema = t.Array(SimilarMediaItemSchema)

export interface SimilarMediaTitles {
  primary: string
  secondary: string | null
  native: string | null
}

export interface SimilarMediaItem {
  id: number
  type: string
  format: string
  coverImage: string | null
  titles: SimilarMediaTitles
}

export type SimilarMediaResponse = SimilarMediaItem[]

export const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "no",
  "to",
  "in",
  "of",
  "and",
  "or",
  "for",
  "with",
  "on",
  "at",
  "by",
  "is",
  "it",
])

export function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s\-_:;,.!?'"()[\]{}]+/g, " ")
    .trim()
}

export function cleanBaseTitle(str: string): string {
  // Extract title before subtitles or separator characters
  let base = str.split(/[:\-\–—;/]/)[0] ?? str
  // Remove season / part / movie descriptors
  base = base
    .replace(
      /\b(season\s*\d+|\d+(st|nd|rd|th)\s*season|part\s*\d+|final\s*season|the\s*final\s*season|the\s*animation|the\s*movie|movie|\d+)\b/gi,
      ""
    )
    .trim()
  return normalizeTitle(base)
}

export function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  const longerLength = longer.length
  if (longerLength === 0) return 1.0

  const costs = new Array(shorter.length + 1)
  for (let i = 0; i <= shorter.length; i++) costs[i] = i

  for (let i = 1; i <= longer.length; i++) {
    let lastValue = i
    costs[0] = i
    for (let j = 1; j <= shorter.length; j++) {
      let newValue = costs[j - 1]
      if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
      }
      costs[j - 1] = lastValue
      lastValue = newValue
    }
    costs[shorter.length] = lastValue
  }

  return (longerLength - costs[shorter.length]) / longerLength
}

export function diceCoefficient(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length < 2 || s2.length < 2) return 0.0

  const bigrams1 = new Map<string, number>()
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2)
    bigrams1.set(bigram, (bigrams1.get(bigram) ?? 0) + 1)
  }

  let intersectionSize = 0
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2)
    const count = bigrams1.get(bigram) ?? 0
    if (count > 0) {
      bigrams1.set(bigram, count - 1)
      intersectionSize++
    }
  }

  return (2.0 * intersectionSize) / (s1.length - 1 + s2.length - 1)
}

export function tokenSimilarity(s1: string, s2: string): number {
  const words1 = s1
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
  const words2 = s2
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
  if (words1.length === 0 || words2.length === 0) return 0.0

  const set1 = new Set(words1)
  const set2 = new Set(words2)
  let common = 0
  for (const w of set1) {
    if (set2.has(w)) common++
  }

  const unionSize = new Set([...words1, ...words2]).size
  const jaccard = unionSize > 0 ? common / unionSize : 0
  const overlapMin =
    Math.min(set1.size, set2.size) > 0
      ? common / Math.min(set1.size, set2.size)
      : 0

  return Math.max(jaccard, overlapMin)
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeTitle(str1)
  const norm2 = normalizeTitle(str2)

  if (!norm1 || !norm2) return 0.0
  if (norm1 === norm2) return 1.0

  // Direct substring containment ratio
  let containmentRatio = 0.0
  if (norm1.includes(norm2) && norm2.length >= 3) {
    containmentRatio = norm2.length / norm1.length
  } else if (norm2.includes(norm1) && norm1.length >= 3) {
    containmentRatio = norm1.length / norm2.length
  }

  const lev = levenshteinSimilarity(norm1, norm2)
  const dice = diceCoefficient(norm1, norm2)
  const token = tokenSimilarity(norm1, norm2)

  return Math.max(containmentRatio, lev, dice, token)
}

export function computeTitleSimilarity(str1: string, str2: string): number {
  // 1. Direct raw string similarity
  const rawSim = calculateStringSimilarity(str1, str2)

  // 2. Base franchise title similarity (handles subtitles, sequel colons, season suffixes)
  const base1 = cleanBaseTitle(str1)
  const base2 = cleanBaseTitle(str2)
  const baseSim =
    base1.length >= 3 && base2.length >= 3
      ? calculateStringSimilarity(base1, base2)
      : 0.0

  return Math.max(rawSim, baseSim)
}

export function isTitleMatch(
  sourceTitles: (string | null | undefined)[],
  candidateTitles: (string | null | undefined)[],
  threshold: number = TITLE_MATCH_THRESHOLD
): boolean {
  const validSource = sourceTitles.filter((t): t is string =>
    Boolean(t && t.trim().length > 0)
  )
  const validCandidate = candidateTitles.filter((t): t is string =>
    Boolean(t && t.trim().length > 0)
  )

  for (const s of validSource) {
    for (const c of validCandidate) {
      if (computeTitleSimilarity(s, c) >= threshold) {
        return true
      }
    }
  }

  return false
}

export function isHashtagMatch(
  sourceTag: string | null | undefined,
  candidateTag: string | null | undefined
): boolean {
  if (!sourceTag || !candidateTag) return false
  const cleanSource = sourceTag.trim().toLowerCase().replace(/^#+/, "")
  const cleanCandidate = candidateTag.trim().toLowerCase().replace(/^#+/, "")
  if (!cleanSource || !cleanCandidate) return false
  return cleanSource === cleanCandidate
}

export function extractSearchKeywords(
  titles: (string | null | undefined)[]
): string[] {
  const keywords: string[] = []

  for (const title of titles) {
    if (!title) continue
    const trimmed = title.trim()
    if (!trimmed) continue

    const base = cleanBaseTitle(trimmed)
    if (base.length >= 3 && !STOPWORDS.has(base)) {
      keywords.push(base)
    }

    const words = normalizeTitle(trimmed).split(/\s+/)
    for (const word of words) {
      if (word.length >= 3 && !STOPWORDS.has(word)) {
        keywords.push(word)
      }
    }
  }

  return Array.from(new Set(keywords)).slice(0, 15)
}
