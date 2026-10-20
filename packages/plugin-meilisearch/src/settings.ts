import { z } from 'zod'

/**
 * The Meilisearch app's settings: pure and client-safe, shared by the admin page, the API
 * service, the worker and the storefront. They live in `store.apps.settings.meilisearch` (no
 * table). Both keys are stored encrypted (`encryptSecret`) and never leave the server; the
 * admin sees only whether each is saved.
 */

export const MEILISEARCH_ID = 'meilisearch'

/** Background jobs the app queues for itself. `products.changed` comes from the outbox. */
export const REINDEX_JOB = 'reindex'

/** Most synonym groups a store keeps, and words in one group. */
export const MAX_SYNONYM_GROUPS = 300
export const MAX_SYNONYM_WORDS = 20

export const MeilisearchSettingsSchema = z.object({
  /** Where Meilisearch answers: `https://search.example.com`. Empty until connected. */
  host: z.string().default(''),
  /** `encryptSecret` blob of the admin (or master) key: indexing and settings. */
  adminKey: z.string().default(''),
  /**
   * `encryptSecret` blob of the search-only key the app created for this store's index. Empty
   * when Meilisearch would not let the admin key create keys; searches then use the admin key,
   * still only on our server.
   */
  searchKey: z.string().default(''),
  /** Meilisearch's uid of that key, so a reconnect can delete the old one. */
  searchKeyUid: z.string().default(''),
  /** Groups of words that mean the same thing ("tee, t-shirt, tshirt"). */
  synonyms: z.array(z.array(z.string())).default([]),
  /** When the last full or partial sync finished (ISO); null until the first one. */
  lastSyncAt: z.string().nullable().default(null),
  /** Products in the index after the last full reindex. */
  lastSyncCount: z.number().int().nonnegative().nullable().default(null),
  /** The last sync's failure in plain words; null when it worked. */
  lastError: z.string().nullable().default(null),
  /** When a "Reindex now" was asked for and has not finished yet (ISO); null otherwise. */
  reindexRequestedAt: z.string().nullable().default(null),
})
export type MeilisearchSettings = z.infer<typeof MeilisearchSettingsSchema>

export const defaultMeilisearchSettings: MeilisearchSettings = MeilisearchSettingsSchema.parse({})

export function parseMeilisearchSettings(raw: unknown): MeilisearchSettings {
  const r = MeilisearchSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultMeilisearchSettings
}

/**
 * What the settings form sends, field by field (zod 4's `.partial()` would fill defaults).
 * `adminKey`: a new key to store, `''` to remove the saved one, left out to keep it.
 */
export const MeilisearchSettingsPatchSchema = z.object({
  host: z.string().trim().max(300).optional(),
  adminKey: z.string().trim().max(500).optional(),
  synonyms: z
    .array(z.array(z.string().trim().max(60)).max(MAX_SYNONYM_WORDS))
    .max(MAX_SYNONYM_GROUPS)
    .optional(),
})
export type MeilisearchSettingsPatch = z.infer<typeof MeilisearchSettingsPatchSchema>

/** The index holding one store's products. Meilisearch uids allow letters, digits, `-` and `_`. */
export const productsIndex = (storeId: string): string => `products_${storeId}`

/** Where a full reindex is built before it is swapped in, so search never sees a half index. */
export const rebuildIndex = (storeId: string): string => `products_${storeId}_rebuild`

/**
 * A pasted Meilisearch address as origin plus any path, no trailing slash. Null when it is not
 * an http(s) URL or carries a username or password.
 */
export function normaliseMeilisearchHost(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

/**
 * Synonym groups from the editor's text: one group per line, words split by commas, trimmed,
 * lowercased, without repeats. A line with fewer than two words is dropped.
 */
export function parseSynonymLines(text: string): string[][] {
  const groups: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    const words = [
      ...new Set(
        line
          .split(',')
          .map((w) => w.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60))
          .filter(Boolean),
      ),
    ].slice(0, MAX_SYNONYM_WORDS)
    if (words.length >= 2) groups.push(words)
    if (groups.length >= MAX_SYNONYM_GROUPS) break
  }
  return groups
}

/** The groups back as editor text, one per line. */
export const synonymLines = (groups: readonly (readonly string[])[]): string =>
  groups.map((g) => g.join(', ')).join('\n')

/**
 * Meilisearch's synonyms setting: every word of a group maps to the others (mutual synonyms).
 * A word in two groups gets both groups' words.
 */
export function synonymsMap(groups: readonly (readonly string[])[]): Record<string, string[]> {
  const out = new Map<string, Set<string>>()
  for (const group of groups) {
    for (const word of group) {
      const others = out.get(word) ?? new Set<string>()
      for (const other of group) if (other !== word) others.add(other)
      out.set(word, others)
    }
  }
  return Object.fromEntries([...out].map(([word, others]) => [word, [...others]]))
}

/** Whether the storefront may ask Meilisearch: connected, a key to search with, indexed once. */
export function searchReady(settings: MeilisearchSettings): boolean {
  return (
    normaliseMeilisearchHost(settings.host) !== null &&
    (settings.searchKey !== '' || settings.adminKey !== '') &&
    settings.lastSyncAt !== null
  )
}

/** The admin's view of the settings: never a key, only whether one is saved. */
export type MeilisearchSettingsView = {
  host: string
  hasAdminKey: boolean
  /** A search-only key exists; false means searches use the admin key on the server. */
  hasSearchKey: boolean
  synonyms: string[][]
  lastSyncAt: string | null
  lastSyncCount: number | null
  lastError: string | null
  reindexing: boolean
  /** Shoppers' searches go through Meilisearch. */
  live: boolean
}

export function meilisearchSettingsView(settings: MeilisearchSettings): MeilisearchSettingsView {
  return {
    host: settings.host,
    hasAdminKey: settings.adminKey !== '',
    hasSearchKey: settings.searchKey !== '',
    synonyms: settings.synonyms,
    lastSyncAt: settings.lastSyncAt,
    lastSyncCount: settings.lastSyncCount,
    lastError: settings.lastError,
    reindexing: settings.reindexRequestedAt !== null,
    live: searchReady(settings),
  }
}
