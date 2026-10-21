/** SOURCE OF TRUTH: the built-in search's stored words — WHAT: the store's catalogue vocabulary (words of active products' titles, vendors, types, tags and option values, cached briefly) and its synonym groups in store.preferences.searchSynonyms / WHY: typo correction and synonyms run on our own Postgres, no search server; writes touch only their key so the Preferences form never loses them */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { MAX_SYNONYM_GROUPS, MAX_SYNONYM_WORDS } from './search-limits'
import {
  cleanSynonymGroups,
  planSearch,
  type SearchPlan,
  type SynonymGroups,
  searchTerms,
  type VocabularyWord,
} from './search-text'

export const SynonymGroupsSchema = z
  .array(z.array(z.string().trim().min(1).max(60)).max(MAX_SYNONYM_WORDS))
  .max(MAX_SYNONYM_GROUPS)

/** How long a store's vocabulary is reused before it is read again. */
const VOCABULARY_TTL_MS = 60_000
const VOCABULARY_MAX_STORES = 500

const vocabularies = new Map<string, { at: number; words: VocabularyWord[] }>()

/** Every word (4+ letters) of the store's active products and how many products use it. */
async function readVocabulary(tx: StoreTx): Promise<VocabularyWord[]> {
  const rows = await tx.execute<{ word: string; count: number }>(sql`
    select w as word, count(distinct src.id)::int as count from (
      select p.id, lower(concat_ws(' ', p.title, p.vendor, p.product_type, array_to_string(p.tags, ' '))) as txt
      from product p where p.status = 'active'
      union all
      select po.product_id, lower(pov.value)
      from product_option po
      join product_option_value pov on pov.option_id = po.id
      join product p on p.id = po.product_id and p.status = 'active'
    ) src, lateral regexp_split_to_table(src.txt, '[^[:alnum:]]+') w
    where length(w) >= 4
    group by w`)
  return rows.map((r) => ({ word: String(r.word), count: Number(r.count) }))
}

/**
 * The store's catalogue words, read at most once a minute per store. Without a store id (a
 * caller that has none) the words are read fresh each time.
 */
async function searchVocabulary(
  tx: StoreTx,
  storeId: string | undefined,
): Promise<VocabularyWord[]> {
  if (!storeId) return readVocabulary(tx)
  const hit = vocabularies.get(storeId)
  if (hit && Date.now() - hit.at < VOCABULARY_TTL_MS) return hit.words
  const words = await readVocabulary(tx)
  if (vocabularies.size >= VOCABULARY_MAX_STORES) {
    const oldest = vocabularies.keys().next().value
    if (oldest) vocabularies.delete(oldest)
  }
  vocabularies.set(storeId, { at: Date.now(), words })
  return words
}

/** The store's synonym groups, cleaned; empty when none are set or the stored value is broken. */
export async function getSearchSynonyms(tx: StoreTx, storeId: string): Promise<SynonymGroups> {
  const [row] = await tx
    .select({ groups: sql<unknown>`${store.preferences} -> 'searchSynonyms'` })
    .from(store)
    .where(eq(store.id, storeId))
  const parsed = SynonymGroupsSchema.safeParse(row?.groups ?? [])
  return parsed.success ? cleanSynonymGroups(parsed.data) : []
}

/** Replaces the store's synonym groups (cleaned), touching only `preferences.searchSynonyms`. */
export async function setSearchSynonyms(
  tx: StoreTx,
  storeId: string,
  groups: SynonymGroups,
): Promise<SynonymGroups> {
  const clean = cleanSynonymGroups(SynonymGroupsSchema.parse(groups))
  await tx
    .update(store)
    .set({
      preferences: sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{searchSynonyms}', ${JSON.stringify(clean)}::jsonb, true)`,
    })
    .where(eq(store.id, storeId))
  return clean
}

/** A search's words: as typed (with synonyms) first, and the typo-corrected plan on demand. */
export type SearchWords = { typed: SearchPlan; corrected: () => Promise<SearchPlan | null> }

/**
 * The shopper's words with the store's synonyms, or null for a listing without a search. The
 * corrected plan reads the store's catalogue words, so it is only built when the typed words
 * found nothing.
 */
export async function searchWordsFor(
  tx: StoreTx,
  storeId: string | undefined,
  query: string | undefined,
): Promise<SearchWords | null> {
  const terms = searchTerms(query ?? '')
  if (!terms.length) return null
  const synonyms = storeId ? await getSearchSynonyms(tx, storeId) : []
  return {
    typed: planSearch(terms, [], synonyms),
    corrected: async () => {
      const plan = planSearch(terms, await searchVocabulary(tx, storeId), synonyms)
      return plan.corrected ? plan : null
    },
  }
}
