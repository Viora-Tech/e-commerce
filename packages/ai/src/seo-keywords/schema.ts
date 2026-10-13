/**
 * SOURCE OF TRUTH: SEO search keywords — WHAT the shape "Suggest keywords" returns (5-10
 * keywords, each with a buy / compare / info intent and one primary pick), the limits on the
 * keywords a product keeps (`product.seo_keywords`, primary first) and the small list helpers
 * the Search keywords card uses / WHY the model, the API, the bulk runner and the admin card
 * agree on one normalised list. Pure and client-safe.
 */
import { z } from 'zod'

/** Why a shopper types it: ready to buy, weighing options, or looking something up. */
export const KEYWORD_INTENTS = ['buy', 'compare', 'info'] as const
export type KeywordIntent = (typeof KEYWORD_INTENTS)[number]

/** Most keywords one product keeps. */
export const SEO_KEYWORDS_MAX = 10

/** Longest keyword kept, in characters (real queries are a few words). */
export const SEO_KEYWORD_LENGTH_MAX = 60

/**
 * What the model must return. No length limits in the schema itself (not every provider's
 * structured output enforces them); `clampKeywords` trims afterwards instead.
 */
export const SeoKeywordsSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z
          .string()
          .describe('A search query exactly as a shopper types it: lowercase, 2-6 words.'),
        intent: z
          .enum(KEYWORD_INTENTS)
          .describe(
            'buy: ready to purchase ("price", "online", "under 2000"); compare: weighing options ("best", "vs", "for gaming"); info: looking something up ("how to", "what is").',
          ),
        primary: z
          .boolean()
          .describe('True for exactly one keyword: the best one to build the search title on.'),
      }),
    )
    .describe('5-10 search keywords for this one product, the most valuable first.'),
})
export type SeoKeywordsOutput = z.infer<typeof SeoKeywordsSchema>

/** One suggestion as the admin shows it. `seen` marks a query that already brought visitors. */
export const SuggestedKeywordSchema = z.object({
  keyword: z.string(),
  intent: z.enum(KEYWORD_INTENTS),
  primary: z.boolean(),
  seen: z.boolean().default(false),
})
export type SuggestedKeyword = z.infer<typeof SuggestedKeywordSchema>

/** A keyword the way it is stored and compared: one line, lowercase, no wrapping quotes. */
export function normaliseKeyword(raw: string): string {
  const clean = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’.,;:!?]+$/g, '')
    .trim()
    .toLowerCase()
  if (clean.length <= SEO_KEYWORD_LENGTH_MAX) return clean
  const slice = clean.slice(0, SEO_KEYWORD_LENGTH_MAX)
  const space = slice.lastIndexOf(' ')
  return (space > 0 ? slice.slice(0, space) : slice).trim()
}

/**
 * The model's keywords cleaned up: normalised, deduplicated, at most `SEO_KEYWORDS_MAX`, with
 * exactly one primary placed first (the model's pick, else the first buy keyword, else the
 * first). `realQueries` (Search Console) marks the ones shoppers already searched.
 */
export function clampKeywords(
  output: SeoKeywordsOutput,
  realQueries: readonly string[] = [],
): SuggestedKeyword[] {
  const seenQueries = new Set(realQueries.map(normaliseKeyword))
  const unique = new Map<string, SuggestedKeyword>()
  for (const k of output.keywords) {
    const keyword = normaliseKeyword(k.keyword)
    if (!keyword || unique.has(keyword)) continue
    unique.set(keyword, {
      keyword,
      intent: k.intent,
      primary: k.primary,
      seen: seenQueries.has(keyword),
    })
  }
  const list = [...unique.values()].slice(0, SEO_KEYWORDS_MAX)
  const primary =
    list.find((k) => k.primary) ?? list.find((k) => k.intent === 'buy') ?? list[0] ?? null
  if (!primary) return []
  return [
    { ...primary, primary: true },
    ...list.filter((k) => k !== primary).map((k) => ({ ...k, primary: false })),
  ]
}

/** Stored suggestions (a bulk run's JSON) read back, or null when there are none. */
export function parseSuggestedKeywords(raw: unknown): SuggestedKeyword[] | null {
  const parsed = z.array(SuggestedKeywordSchema).safeParse(raw)
  return parsed.success && parsed.data.length ? parsed.data : null
}

/** The suggestions as a product keeps them: keyword text only, primary first. */
export function keywordList(suggestions: readonly SuggestedKeyword[]): string[] {
  const ordered = [
    ...suggestions.filter((k) => k.primary),
    ...suggestions.filter((k) => !k.primary),
  ]
  return [...new Set(ordered.map((k) => normaliseKeyword(k.keyword)).filter(Boolean))].slice(
    0,
    SEO_KEYWORDS_MAX,
  )
}

/** `list` with `raw` added at the end, unless it is empty, already there or the list is full. */
export function addKeyword(list: readonly string[], raw: string): string[] {
  const keyword = normaliseKeyword(raw)
  if (!keyword || list.includes(keyword) || list.length >= SEO_KEYWORDS_MAX) return [...list]
  return [...list, keyword]
}

/**
 * The picked suggestions added to what the product has. A product with no keywords takes the
 * AI's primary pick as its primary; one that has keywords keeps its own primary and order.
 */
export function mergeKeywords(
  current: readonly string[],
  picked: readonly SuggestedKeyword[],
): string[] {
  return keywordList(picked).reduce((list, keyword) => addKeyword(list, keyword), [...current])
}

/** `list` with `keyword` moved to the front, where the primary keyword lives. */
export function makePrimary(list: readonly string[], keyword: string): string[] {
  return list.includes(keyword) ? [keyword, ...list.filter((k) => k !== keyword)] : [...list]
}

/** True when `text` holds `keyword` as whole words, ignoring case and spacing. */
export function containsKeyword(text: string, keyword: string): boolean {
  const words = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
      .trim()
  const needle = words(keyword)
  return needle.length > 0 && ` ${words(text)} `.includes(` ${needle} `)
}
