/** SOURCE OF TRUTH: built-in search's word handling — WHAT: typo correction of a shopper's search words against the store's own catalogue words, and synonym groups that let one word also match its alternatives / WHY: Shopify Search & Discovery-style forgiving search with no outside engine; `browseProducts` and `suggestProducts` match the corrected, expanded words in SQL */

/** Synonym groups: each group's words all mean the same thing ("kb", "keyboard"). */
export type SynonymGroups = string[][]

/** What a search actually matches: one list of alternatives per typed word, every word required. */
export type SearchPlan = {
  /** The words searched for after correction, in the shopper's order. */
  terms: string[]
  /** Per term, the term and its synonyms; a product matches when each group has a hit. */
  groups: string[][]
  /**
   * Per term, the term run together from two catalogue words, split back ("glasspad" →
   * "glass pad"): a product's own fields holding both words also count as a hit ("Glass
   * Mousepad"), as Shopify's search finds them. Empty lists for terms that split no way.
   */
  splits: string[][]
  /**
   * `all` (the default): every term must match. `any`: a product matching some of the terms in
   * its own fields is in too, ranked after the ones matching all of them, for a multi-word
   * search whose every word found (almost) nothing together ("dysphoria aria").
   */
  mode: 'all' | 'any'
  /** The corrected query when any word was changed ("keybord" → "keyboard"), else null. */
  corrected: string | null
}

/** Up to eight distinct words of a search query; every one has to match somewhere. */
export function searchTerms(query: string): string[] {
  const words = query.trim().slice(0, 100).toLowerCase().split(/\s+/).filter(Boolean)
  return [...new Set(words)].slice(0, 8)
}

/** Shorter words are left alone: too many real words sit one letter apart ("mat", "map"). */
const MIN_CORRECT_LENGTH = 4

/** Edits allowed for a word of this length: 1 up to 7 letters, 2 from 8 ("mecanical"). */
export function maxEdits(length: number): number {
  if (length < MIN_CORRECT_LENGTH) return 0
  return length >= 8 ? 2 : 1
}

/**
 * Optimal string alignment distance (Levenshtein plus swapping two neighbours, "keybaord"),
 * or `max + 1` as soon as it must exceed `max`, so a large vocabulary stays cheap to scan.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (a === b) return 0
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, (prev2[j - 2] ?? 0) + 1)
      }
      row.push(d)
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = row
  }
  return Math.min(prev[b.length] ?? max + 1, max + 1)
}

/** A catalogue word and how many products use it; the commoner word wins a tie. */
export type VocabularyWord = { word: string; count: number }

/**
 * The closest catalogue word to a misspelt `term`, or null when the term is fine as typed
 * (some catalogue word contains it, since SQL matches inside words), is a number or SKU-like,
 * is too short to correct safely, or nothing is close enough.
 */
export function correctTerm(term: string, vocabulary: VocabularyWord[]): string | null {
  const allowed = maxEdits(term.length)
  if (allowed === 0 || /\d/.test(term)) return null
  if (vocabulary.some((v) => v.word.includes(term))) return null
  let best: VocabularyWord | null = null
  let bestDistance = allowed + 1
  for (const v of vocabulary) {
    if (v.word.length < MIN_CORRECT_LENGTH) continue
    const d = editDistance(term, v.word, allowed)
    if (d < bestDistance || (d === bestDistance && best && v.count > best.count)) {
      best = v
      bestDistance = d
    }
  }
  return best && bestDistance <= allowed ? best.word : null
}

/** The shortest part a run-together word splits into ("pad"). */
const MIN_SPLIT_PART = 3

/**
 * `term` read as two catalogue words written together, most-used split first, at most two:
 * "glasspad" → ["glass pad"]. Words with digits (models, SKUs) and short words never split.
 */
function splitTerm(term: string, vocabulary: VocabularyWord[]): string[] {
  if (term.length < MIN_SPLIT_PART * 2 || /[\d\s]/.test(term)) return []
  const counts = new Map(vocabulary.map((v) => [v.word, v.count]))
  const found: { phrase: string; score: number }[] = []
  for (let i = MIN_SPLIT_PART; i <= term.length - MIN_SPLIT_PART; i++) {
    const left = counts.get(term.slice(0, i))
    const right = counts.get(term.slice(i))
    if (left && right) {
      found.push({ phrase: `${term.slice(0, i)} ${term.slice(i)}`, score: Math.min(left, right) })
    }
  }
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((f) => f.phrase)
}

/** Lower-cased words, trimmed and de-duplicated, each group kept only with two or more words. */
export function cleanSynonymGroups(groups: SynonymGroups): SynonymGroups {
  const out: SynonymGroups = []
  for (const g of groups) {
    const words = [
      ...new Set(g.map((w) => w.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean)),
    ]
    if (words.length >= 2) out.push(words)
  }
  return out
}

/** The synonyms of `term` (itself first), from every group that holds it. */
export function synonymsOf(term: string, groups: SynonymGroups): string[] {
  const all = new Set([term])
  for (const g of groups) if (g.includes(term)) for (const w of g) all.add(w)
  return [...all]
}

/**
 * The search for these words: a known word or one with synonyms is kept; with `correct`, any
 * other word is corrected to the nearest catalogue word when one is close. Each word then
 * matches itself, any of its synonyms, or its two catalogue words when it runs two together.
 */
export function planSearch(
  terms: string[],
  vocabulary: VocabularyWord[],
  synonyms: SynonymGroups,
  correct = true,
): SearchPlan {
  let changed = false
  const fixed = terms.map((t) => {
    if (!correct || synonymsOf(t, synonyms).length > 1) return t
    const c = correctTerm(t, vocabulary)
    if (!c || c === t) return t
    changed = true
    return c
  })
  return {
    terms: fixed,
    groups: fixed.map((t) => synonymsOf(t, synonyms)),
    splits: fixed.map((t) => splitTerm(t, vocabulary)),
    corrected: changed ? fixed.join(' ') : null,
    mode: 'all',
  }
}
