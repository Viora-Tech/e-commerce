/** SOURCE OF TRUTH: the Inbox knowledge base's pure rules — WHAT: `pickKnowledge` (which published answers the AI agent reads for a question), `factFromMetaobject` / `isKnowledgeFactsDefinition` (turning Shopify's imported "Knowledge Base Facts" entries into answers) and `asksForRefundOrCancel` (a refund or cancellation goes straight to staff) / WHY: the worker, the admin page and the import must agree, and these run without a database. Pure: client components import it through `@commerce/core/inbox`. */

export const KNOWLEDGE_TITLE_MAX = 200
export const KNOWLEDGE_ANSWER_MAX = 2000
/** Most entries a store keeps; a knowledge base is short answers, not a help centre. */
export const KNOWLEDGE_ENTRIES_MAX = 200
/** Most answers the AI reads for one question, and the characters they may add up to. */
const KNOWLEDGE_PICK_MAX = 12
const KNOWLEDGE_PICK_BUDGET = 6000

export type KnowledgeEntry = { title: string; answer: string }

/** Words worth matching: three letters or more, lower case, at most `max`, no repeats. */
export function questionWords(text: string, max = 5): string[] {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3)
  return [...new Set(words)].slice(0, max)
}

/**
 * The published answers the AI reads for `question`: those sharing the most words with it
 * first (a title match counts double), then the store's own order, until `max` entries or
 * `budget` characters. Answers that share no word still come after, so a short knowledge base
 * is read whole ("do you ship to Pune?" should still see "Shipping time").
 */
export function pickKnowledge<T extends KnowledgeEntry>(
  entries: readonly T[],
  question: string,
  max = KNOWLEDGE_PICK_MAX,
  budget = KNOWLEDGE_PICK_BUDGET,
): T[] {
  const words = questionWords(question, 12)
  const score = (e: KnowledgeEntry) => {
    const title = e.title.toLowerCase()
    const answer = e.answer.toLowerCase()
    return words.reduce((n, w) => n + (title.includes(w) ? 2 : 0) + (answer.includes(w) ? 1 : 0), 0)
  }
  // Stable sort: equal scores keep the store's order.
  const ranked = entries
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
  const out: T[] = []
  let used = 0
  for (const { e } of ranked) {
    if (out.length === max) break
    const size = e.title.length + e.answer.length
    if (used + size > budget) continue
    used += size
    out.push(e)
  }
  return out
}

/** Shopify's knowledge base content type, by its handle or its name. */
export function isKnowledgeFactsDefinition(d: { type: string; name: string }): boolean {
  return /knowledge_base_fact/.test(d.type) || /^knowledge base facts?$/i.test(d.name.trim())
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const truthy = (v: unknown): boolean => v === true || v === 'true'

/** A value field as words: text, a list joined with commas, Yes/No, or a number. */
function valueText(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.map(valueText).filter(Boolean).join(', ')
  return ''
}

/** "shipping_info" → "Shipping info": a fallback title when an entry has none. */
function categoryTitle(category: string): string {
  const words = category
    .replace(/_/g, ' ')
    .replace(/\binfo\b/, '')
    .trim()
  return words ? words[0]?.toUpperCase() + words.slice(1) : ''
}

export type ImportedFact = { title: string; answer: string; published: boolean }

/**
 * One imported "Knowledge Base Facts" entry as an answer. Shopify keeps the merchant's answer
 * in `value_*` and its own unconfirmed guess in `suggested_value_*`: a guess is copied as a
 * draft (never published), so nothing Shopify inferred reaches shoppers unchecked. Null when
 * the entry holds no answer at all.
 */
export function factFromMetaobject(
  fields: Record<string, unknown>,
  status: 'draft' | 'active' = 'active',
): ImportedFact | null {
  const confirmed =
    valueText(fields.value_string) ||
    valueText(fields.value_string_list) ||
    valueText(fields.value_boolean) ||
    valueText(fields.value_number)
  const suggested =
    valueText(fields.suggested_value_string) ||
    valueText(fields.suggested_value_string_list) ||
    valueText(fields.suggested_value_boolean) ||
    valueText(fields.suggested_value_number)
  const answer = (confirmed || suggested).slice(0, KNOWLEDGE_ANSWER_MAX)
  if (!answer) return null
  const title = (text(fields.title) || categoryTitle(text(fields.category)) || answer).slice(
    0,
    KNOWLEDGE_TITLE_MAX,
  )
  return {
    title,
    answer,
    published: Boolean(confirmed) && truthy(fields.published) && status === 'active',
  }
}

/*
 * Asking for a refund, return, cancellation or exchange, in English, Hinglish and Hindi. Asking
 * about the policy ("what is your return policy?") is not a match: the AI can answer that from
 * the knowledge base. A match hands the chat to staff without a model call.
 */
const REFUND_PATTERNS = [
  /\b(i want|i need|i'd like|i would like|please|pls|plz|kindly|want to|need to|how (do|can) i|can (you|i))\b[^.?!]{0,30}\b(refund|cancel|return|exchange|replace)/i,
  /\b(refund|cancel|return|exchange|replace)\w*\b[^.?!]{0,20}\b(my|this|the)\s+(order|item|product|payment|money)\b/i,
  /\b(refund|cancel|return|exchange|replace)\w*\s+(it|kar|karo|kardo|krdo|karna|krna|chahiye|chaiye)\b/i,
  /\bmy\s+(refund|money)\b/i,
  /\b(paise|paisa)\s+(wapas|vapas)\b/i,
  /रिफ़ंड\s*(चाहिए|दो|दे|कब)|रिफंड\s*(चाहिए|दो|दे|कब)|पैसे\s*वापस|ऑर्डर\s*(कैंसिल|रद्द)|(कैंसिल|रद्द)\s*कर/,
]

/** Whether a shopper's message asks for a refund, return, cancellation or exchange. */
export function asksForRefundOrCancel(text: string): boolean {
  return REFUND_PATTERNS.some((p) => p.test(text))
}
