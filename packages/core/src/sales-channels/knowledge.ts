/** SOURCE OF TRUTH: the store knowledge base for AI agents — WHAT: the facts an agent may tell shoppers about the store (about, brands and products, shopping, FAQ), each drafted by AI or written by the merchant and published one by one, kept on `store.preferences.agentKnowledge` / WHY: agents answer "is this an Indian brand?" or "can I return it?" from facts the merchant approved, never from a guess (owner, 17 Nov 2026, after Shopify's Knowledge base). Pure, safe for the browser. */
import { z } from 'zod'

export const KNOWLEDGE_GROUPS = ['about', 'brands', 'shopping', 'faq'] as const
export type KnowledgeGroup = (typeof KNOWLEDGE_GROUPS)[number]

/** Every fact the knowledge base holds, in page order. `kind` decides how it is edited. */
export const KNOWLEDGE_FACTS = [
  { key: 'description', group: 'about', kind: 'text' },
  { key: 'audience', group: 'about', kind: 'text' },
  { key: 'founded', group: 'about', kind: 'text' },
  { key: 'location', group: 'about', kind: 'text' },
  { key: 'brands', group: 'brands', kind: 'tags' },
  { key: 'categories', group: 'brands', kind: 'tags' },
  { key: 'values', group: 'brands', kind: 'tags' },
  { key: 'style', group: 'brands', kind: 'text' },
  { key: 'shipping', group: 'shopping', kind: 'text' },
  { key: 'payments', group: 'shopping', kind: 'text' },
  { key: 'returns', group: 'shopping', kind: 'text' },
  { key: 'support', group: 'shopping', kind: 'text' },
  { key: 'faq', group: 'faq', kind: 'faq' },
] as const satisfies readonly { key: string; group: KnowledgeGroup; kind: string }[]

export type KnowledgeKey = (typeof KNOWLEDGE_FACTS)[number]['key']
export type KnowledgeKind = (typeof KNOWLEDGE_FACTS)[number]['kind']
export const KNOWLEDGE_KEYS = KNOWLEDGE_FACTS.map((f) => f.key) as [KnowledgeKey, ...KnowledgeKey[]]

export const KNOWLEDGE_TEXT_MAX = 600
export const KNOWLEDGE_TAGS_MAX = 12
export const KNOWLEDGE_FAQ_MAX = 8

const Text = z.string().trim().max(KNOWLEDGE_TEXT_MAX)
const Tag = z.string().trim().min(1).max(60)
export const FaqItemSchema = z.object({
  q: z.string().trim().min(1).max(200),
  a: z.string().trim().min(1).max(KNOWLEDGE_TEXT_MAX),
})
export type FaqItem = z.infer<typeof FaqItemSchema>

/** What one fact says: text, a short list (brands), or questions and answers. */
export const KnowledgeValueSchema = z.object({
  text: Text.default(''),
  tags: z.array(Tag).max(KNOWLEDGE_TAGS_MAX).default([]),
  faq: z.array(FaqItemSchema).max(KNOWLEDGE_FAQ_MAX).default([]),
})
export type KnowledgeValue = z.infer<typeof KnowledgeValueSchema>
/** A value as an edit or a scan gives it: any part may be missing. */
export type KnowledgeValueInput = {
  text?: string | undefined
  tags?: string[] | undefined
  faq?: { q: string; a: string }[] | undefined
}

const KnowledgeFactSchema = KnowledgeValueSchema.extend({
  published: z.boolean().catch(false),
  /** `ai`: drafted by a scan and untouched; a rescan may rewrite it while unpublished. */
  source: z.enum(['ai', 'merchant']).catch('ai'),
  updatedAt: z.string().nullable().catch(null),
})
export type KnowledgeFact = z.infer<typeof KnowledgeFactSchema>

const AgentKnowledgeSchema = z.object({
  facts: z.record(z.string(), KnowledgeFactSchema.catch(undefined as never)).catch({}),
  scannedAt: z.string().nullable().catch(null),
})
export type AgentKnowledge = {
  facts: Partial<Record<KnowledgeKey, KnowledgeFact>>
  scannedAt: string | null
}

export const EMPTY_KNOWLEDGE: AgentKnowledge = { facts: {}, scannedAt: null }

/** `store.preferences.agentKnowledge`, unknown keys and broken facts dropped. */
export function parseAgentKnowledge(preferences: unknown): AgentKnowledge {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).agentKnowledge
      : undefined
  const r = AgentKnowledgeSchema.safeParse(raw ?? {})
  if (!r.success) return EMPTY_KNOWLEDGE
  const facts: AgentKnowledge['facts'] = {}
  for (const key of KNOWLEDGE_KEYS) {
    const fact = r.data.facts[key]
    if (fact && !isEmptyKnowledge(fact)) facts[key] = fact
  }
  return { facts, scannedAt: r.data.scannedAt }
}

export const kindOf = (key: KnowledgeKey): KnowledgeKind =>
  KNOWLEDGE_FACTS.find((f) => f.key === key)?.kind ?? 'text'

export function isEmptyKnowledge(v: KnowledgeValue): boolean {
  return !v.text.trim() && v.tags.length === 0 && v.faq.length === 0
}

/** Keeps only the part of a value its kind uses, so a text fact never carries stray tags. */
export function cleanValue(key: KnowledgeKey, v: KnowledgeValueInput): KnowledgeValue {
  const parsed = KnowledgeValueSchema.parse({
    text: (v.text ?? '').slice(0, KNOWLEDGE_TEXT_MAX),
    tags: [...new Set((v.tags ?? []).map((t) => t.trim()).filter(Boolean))]
      .map((t) => t.slice(0, 60))
      .slice(0, KNOWLEDGE_TAGS_MAX),
    faq: (v.faq ?? [])
      .filter((f) => f.q?.trim() && f.a?.trim())
      .map((f) => ({ q: f.q.trim().slice(0, 200), a: f.a.trim().slice(0, KNOWLEDGE_TEXT_MAX) }))
      .slice(0, KNOWLEDGE_FAQ_MAX),
  })
  const kind = kindOf(key)
  return {
    text: kind === 'text' ? parsed.text : '',
    tags: kind === 'tags' ? parsed.tags : [],
    faq: kind === 'faq' ? parsed.faq : [],
  }
}

/**
 * A scan's drafts merged into what the store has: a fact the merchant published or wrote stays
 * as it is; an unpublished AI draft is replaced; a fact the scan left empty is kept.
 */
export function mergeDraft(
  current: AgentKnowledge,
  draft: Partial<Record<KnowledgeKey, KnowledgeValueInput>>,
  now: string,
): AgentKnowledge {
  const facts: AgentKnowledge['facts'] = { ...current.facts }
  for (const key of KNOWLEDGE_KEYS) {
    const next = draft[key]
    if (!next) continue
    const value = cleanValue(key, next)
    if (isEmptyKnowledge(value)) continue
    const have = facts[key]
    if (have && (have.published || have.source === 'merchant')) continue
    facts[key] = { ...value, published: false, source: 'ai', updatedAt: now }
  }
  return { facts, scannedAt: now }
}

/** Published facts only: all an agent, llms.txt or the store endpoint ever sees. */
export function publishedFacts(k: AgentKnowledge): { key: KnowledgeKey; fact: KnowledgeFact }[] {
  return KNOWLEDGE_KEYS.flatMap((key) => {
    const fact = k.facts[key]
    return fact?.published ? [{ key, fact }] : []
  })
}

export function knowledgeCounts(k: AgentKnowledge): { published: number; total: number } {
  const all = KNOWLEDGE_KEYS.filter((key) => k.facts[key])
  return { published: all.filter((key) => k.facts[key]?.published).length, total: all.length }
}

/** Plain-English labels for each fact, for agents and llms.txt (the admin has its own copy). */
export const KNOWLEDGE_LABELS: Record<KnowledgeKey, string> = {
  description: 'About the store',
  audience: 'Who it is for',
  founded: 'Founded',
  location: 'Based in',
  brands: 'Brands sold',
  categories: 'What it sells',
  values: 'Brand values',
  style: 'Style',
  shipping: 'Shipping',
  payments: 'Payment options',
  returns: 'Returns',
  support: 'Customer support',
  faq: 'Frequently asked questions',
}

/** One fact as plain lines, for llms.txt and the store endpoint. */
/**
 * Published store facts as question-and-answer entries, for the store chat AI (one Knowledge
 * base for both readers, owner 18 Nov 2026): each FAQ pair as its own entry, any other fact
 * under its label.
 */
export function factEntries(k: AgentKnowledge): { title: string; answer: string }[] {
  return publishedFacts(k).flatMap(({ key, fact }) => {
    if (fact.faq.length) return fact.faq.map((f) => ({ title: f.q, answer: f.a }))
    const answer = fact.tags.length ? fact.tags.join(', ') : fact.text
    return answer ? [{ title: KNOWLEDGE_LABELS[key], answer }] : []
  })
}

export function factLines(key: KnowledgeKey, fact: KnowledgeValue): string[] {
  const label = KNOWLEDGE_LABELS[key]
  if (fact.faq.length) return fact.faq.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`])
  if (fact.tags.length) return [`${label}: ${fact.tags.join(', ')}`]
  return fact.text ? [`${label}: ${fact.text}`] : []
}
