import type { SettingsSearchEntry } from '@/data/settings-search'

const MAX_RESULTS = 8

const norm = (s: string) => s.toLowerCase().trim()

/** How well one entry matches one word: 0 is no match, higher is better. */
function wordScore(entry: SettingsSearchEntry, word: string): number {
  const title = norm(entry.title)
  if (title.startsWith(word)) return 6
  if (title.split(/[\s(),/]+/).some((w) => w.startsWith(word))) return 5
  if (entry.keywords.includes(word)) return 4
  if (title.includes(word)) return 3
  if (entry.keywords.some((k) => k.startsWith(word))) return 2
  if (entry.keywords.some((k) => k.includes(word)) || norm(entry.where).includes(word)) return 1
  return 0
}

/**
 * Settings pages and fields for what someone typed. Every word must match the
 * title, the page or a synonym; titles beat synonyms. A whole-phrase synonym
 * ("cash on delivery") counts as a match for every word in it.
 */
export function searchSettings(
  index: readonly SettingsSearchEntry[],
  query: string,
): SettingsSearchEntry[] {
  const q = norm(query)
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: { entry: SettingsSearchEntry; score: number }[] = []
  for (const entry of index) {
    const phrase = entry.keywords.includes(q) || norm(entry.title).includes(q) ? 10 : 0
    const scores = words.map((w) => wordScore(entry, w))
    if (!phrase && scores.some((s) => s === 0)) continue
    scored.push({ entry, score: phrase + scores.reduce((a, b) => a + b, 0) })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((s) => s.entry)
}

/** The page alone from a result's "Selling › Checkout" trail, for the right side of a result row. */
export function settingsPageOf(where: string): string {
  return where.split(' › ').at(-1) ?? where
}
