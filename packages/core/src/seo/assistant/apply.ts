/** SOURCE OF TRUTH: applying SEO assistant drafts — WHAT: the limits a search title and description must fit (60 and 155 characters), trimming text to them on a word edge, which permission each resource's edit needs, and the plan that turns the merchant's approved drafts into the same product, collection and page writes their own editors make / WHY: the API applies exactly what the preview showed, nothing else, and the admin hides Apply where the member could not save. Pure and client-safe */
import { type Permission, permissions } from '../../permissions/statement'
import type { SeoAssistantResource } from './opportunity'

/** What Google shows before cutting off, as the assistant writes them. */
export const SEO_ASSISTANT_LIMITS = {
  titleMax: 60,
  descriptionMax: 155,
  snippetMinWords: 80,
  snippetMaxWords: 150,
  /** Items one "Fix with AI" run drafts. */
  draftMax: 10,
  /** Items one Apply writes. */
  applyMax: 50,
} as const

/**
 * One line, at most `max` characters, cut at the last word edge (no half words, no trailing
 * punctuation left dangling). Text already short enough only loses extra spaces.
 */
export function fitChars(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max + 1)
  const edge = slice.lastIndexOf(' ')
  const cut = edge > max * 0.5 ? slice.slice(0, edge) : clean.slice(0, max)
  return cut.replace(/[\s,;:–—-]+$/, '').trim()
}

export const wordsIn = (text: string): number => text.split(/\s+/).filter(Boolean).length

/**
 * At most `max` words, ending on a full sentence when one ends in the last third, so a long
 * snippet never stops mid-thought. Line breaks (an FAQ's question and answer) are kept.
 */
export function fitWords(text: string, max: number): string {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
  const out: string[] = []
  let used = 0
  for (const line of lines) {
    if (used >= max) break
    const words = line.split(' ').filter(Boolean)
    if (used + words.length <= max) {
      out.push(line)
      used += words.length
      continue
    }
    out.push(words.slice(0, max - used).join(' '))
    used = max
  }
  const joined = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (wordsIn(text) <= max) return joined
  const lastStop = Math.max(joined.lastIndexOf('. '), joined.lastIndexOf('.\n'))
  if (lastStop > joined.length * 0.66) return joined.slice(0, lastStop + 1).trim()
  return joined.replace(/[,;:–—-]+$/, '').trim()
}

/** Who may change each resource's search listing: its own editor's permission. */
export const SEO_APPLY_PERMISSION: Record<SeoAssistantResource, Permission> = {
  product: permissions.PRODUCTS_WRITE,
  collection: permissions.PRODUCTS_WRITE,
  page: permissions.ONLINE_STORE_WRITE,
}

/** The permissions a set of resources needs, each once. */
export function applyPermissions(resources: readonly SeoAssistantResource[]): Permission[] {
  return [...new Set(resources.map((r) => SEO_APPLY_PERMISSION[r]))]
}

/** One approved draft, as the admin sends it back. */
export type SeoApplyChange = {
  resource: SeoAssistantResource
  id: string
  seoTitle: string
  seoDescription: string
}

/** The writes: the same fields each resource's own editor saves. */
export type SeoApplyPlan = {
  products: {
    productId: string
    patch: { seoTitle: string | null; seoDescription: string | null }
  }[]
  collections: { id: string; write: { seoTitle: string | null; seoDescription: string | null } }[]
  pages: { id: string; input: { seoTitle: string | null; seoDescription: string | null } }[]
}

/**
 * Approved drafts as writes, re-trimmed to the limits (the merchant may have edited them in the
 * preview). A blank field becomes null (the item's own title or text shows on Google again).
 * One item listed twice keeps its last change.
 */
export function seoApplyPlan(changes: readonly SeoApplyChange[]): SeoApplyPlan {
  const last = new Map<string, SeoApplyChange>()
  for (const c of changes) last.set(`${c.resource}:${c.id}`, c)
  const plan: SeoApplyPlan = { products: [], collections: [], pages: [] }
  for (const c of last.values()) {
    const fields = {
      seoTitle: fitChars(c.seoTitle, SEO_ASSISTANT_LIMITS.titleMax) || null,
      seoDescription: fitChars(c.seoDescription, SEO_ASSISTANT_LIMITS.descriptionMax) || null,
    }
    if (c.resource === 'product') plan.products.push({ productId: c.id, patch: fields })
    else if (c.resource === 'collection') plan.collections.push({ id: c.id, write: fields })
    else plan.pages.push({ id: c.id, input: fields })
  }
  return plan
}

/** One draft as the preview shows it, inside the limits. */
export type SeoDraft = {
  seoTitle: string
  seoDescription: string
  snippet: string
  /** Words in the snippet; under `snippetMinWords` the preview says it is short. */
  snippetWords: number
}

/** What the model wrote, cut to the limits (models do not always keep to them). */
export function clampSeoDraft(raw: {
  seoTitle: string
  seoDescription: string
  snippet: string
}): SeoDraft {
  const snippet = fitWords(raw.snippet, SEO_ASSISTANT_LIMITS.snippetMaxWords)
  return {
    seoTitle: fitChars(raw.seoTitle.replace(/^["'“]+|["'”]+$/g, ''), SEO_ASSISTANT_LIMITS.titleMax),
    seoDescription: fitChars(raw.seoDescription, SEO_ASSISTANT_LIMITS.descriptionMax),
    snippet,
    snippetWords: wordsIn(snippet),
  }
}
