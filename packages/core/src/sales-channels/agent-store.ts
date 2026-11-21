/** SOURCE OF TRUTH: what an AI agent reads from a store — WHAT: product search, one product, and the store's published knowledge and policies, shaped for agents and limited by Agentic sales → Controls (hidden tags, chosen collections) / WHY: the storefront's public agent endpoint (`/api/mcp`) and the admin's "Test a query" must show agents exactly the same thing. */
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { richTextToText } from '../blog/text'
import { suggestProducts } from '../catalog/browse'
import { listPolicies } from '../policies/service'
import { publishedKnowledge } from '../inbox/knowledge'
import { buildChannelCatalog, type ChannelItem } from './catalog'
import { parseSalesChannels } from './client'
import { factLines, parseAgentKnowledge, publishedFacts } from './knowledge'

export type AgentVariant = {
  id: string
  title: string
  price: string
  compareAtPrice: string | null
  available: boolean
  sku: string | null
}

export type AgentProduct = {
  title: string
  url: string
  brand: string
  description: string
  image: string | null
  priceRange: { min: string; max: string; currency: 'INR' }
  available: boolean
  variants: AgentVariant[]
}

const AGENT_SEARCH_MAX = 10
const SHORT_DESCRIPTION = 400

const rupees = (paise: number) => (paise / 100).toFixed(2)

/** Channel items (one per variant) grouped into products, in the order of `handles`. */
export function groupAgentProducts(
  items: ChannelItem[],
  handles: string[],
  opts: { full?: boolean } = {},
): AgentProduct[] {
  const byGroup = new Map<string, ChannelItem[]>()
  for (const item of items) {
    const list = byGroup.get(item.groupId) ?? []
    list.push(item)
    byGroup.set(item.groupId, list)
  }
  const handleOf = (link: string) => new URL(link).pathname.split('/').at(-1) ?? ''
  const products = [...byGroup.values()].map((variants) => {
    const first = variants[0] as ChannelItem
    const prices = variants.map((v) => v.pricePaise)
    const url = first.link.split('?')[0] as string
    const description = opts.full
      ? first.description
      : first.description.length > SHORT_DESCRIPTION
        ? `${first.description.slice(0, SHORT_DESCRIPTION).trimEnd()}...`
        : first.description
    const product: AgentProduct = {
      title: variants.length === 1 ? first.title : (first.title.split(' - ')[0] ?? first.title),
      url,
      brand: first.brand,
      description,
      image: first.imageLink,
      priceRange: {
        min: rupees(Math.min(...prices)),
        max: rupees(Math.max(...prices)),
        currency: 'INR',
      },
      available: variants.some((v) => v.availability !== 'out_of_stock'),
      variants: variants.map((v) => ({
        id: v.id,
        title:
          variants.length === 1 ? 'Default' : v.title.slice(v.title.indexOf(' - ') + 3) || v.title,
        price: rupees(v.pricePaise),
        compareAtPrice: v.mrpPaise ? rupees(v.mrpPaise) : null,
        available: v.availability !== 'out_of_stock',
        sku: v.sku,
      })),
    }
    return { handle: handleOf(url), product }
  })
  const rank = new Map(handles.map((h, i) => [h, i]))
  return products
    .sort((a, b) => (rank.get(a.handle) ?? 99) - (rank.get(b.handle) ?? 99))
    .map((p) => p.product)
}

/** The store's name, for the agent endpoint's greeting. */
export async function agentStoreName(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}

async function agentControls(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return parseSalesChannels(s?.preferences).agents
}

/** Products matching `query`, best first, only those agents may see. */
export async function searchAgentProducts(
  tx: StoreTx,
  storeId: string,
  input: { query: string; limit?: number | undefined; origin: string },
): Promise<AgentProduct[]> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), AGENT_SEARCH_MAX)
  // Ask for more than needed: some may be hidden from agents by Controls.
  const handles = await suggestProducts(tx, input.query, limit * 2, storeId)
  if (!handles.length) return []
  const items = await buildChannelCatalog(tx, storeId, {
    origin: input.origin,
    agents: await agentControls(tx, storeId),
    handles,
  })
  return groupAgentProducts(items, handles).slice(0, limit)
}

/** One product by its handle or URL, if agents may see it. */
export async function agentProduct(
  tx: StoreTx,
  storeId: string,
  input: { handle: string; origin: string },
): Promise<AgentProduct | null> {
  const handle = input.handle.trim().split('?')[0]?.split('/').filter(Boolean).at(-1) ?? ''
  if (!handle) return null
  const items = await buildChannelCatalog(tx, storeId, {
    origin: input.origin,
    agents: await agentControls(tx, storeId),
    handles: [handle],
  })
  return groupAgentProducts(items, [handle], { full: true })[0] ?? null
}

export type AgentStoreInfo = {
  name: string
  url: string
  facts: string[]
  policies: { title: string; url: string; text: string }[]
}

const POLICY_TEXT_MAX = 4000

/** The store's published knowledge and published policies, as an agent reads them. */
export async function agentStoreInfo(
  tx: StoreTx,
  storeId: string,
  origin: string,
): Promise<AgentStoreInfo> {
  const [[s], policies, answers] = await Promise.all([
    tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId)),
    listPolicies({ tx, storeId }),
    publishedKnowledge(tx),
  ])
  const base = origin.replace(/\/$/, '')
  return {
    name: s?.name ?? '',
    url: base,
    // One Knowledge base: the store facts, then the published Inbox answers.
    facts: [
      ...publishedFacts(parseAgentKnowledge(s?.preferences)).flatMap(({ key, fact }) =>
        factLines(key, fact),
      ),
      ...answers.map((a) => `${a.title}: ${a.answer}`),
    ],
    policies: policies
      .filter((p) => p.published && p.body)
      .map((p) => ({
        title: p.title,
        url: `${base}/policies/${p.type}`,
        text: richTextToText(p.body).slice(0, POLICY_TEXT_MAX),
      })),
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter((w) => w.length > 2)

/**
 * Facts and policy passages that answer `query`: facts whose words match, and each policy
 * paragraph that shares a word with it. No query: every fact and the policy titles.
 */
export function answerFromStoreInfo(
  info: AgentStoreInfo,
  query: string,
): { facts: string[]; policies: { title: string; url: string; text: string }[] } {
  const q = new Set(words(query))
  if (!q.size)
    return { facts: info.facts, policies: info.policies.map((p) => ({ ...p, text: '' })) }
  const hits = (text: string) => words(text).filter((w) => q.has(w)).length
  const facts = info.facts.filter((f) => hits(f) > 0)
  const policies = info.policies
    .map((p) => {
      const paras = p.text
        .split(/\n+/)
        .map((t) => ({ t, n: hits(t) + hits(p.title) }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 4)
      return { ...p, text: paras.map((x) => x.t).join('\n'), score: paras[0]?.n ?? 0 }
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _s, ...p }) => p)
  return { facts: facts.length ? facts : info.facts, policies }
}
