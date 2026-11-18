/** SOURCE OF TRUTH: loading and saving the store knowledge base — WHAT: read and write `store.preferences.agentKnowledge` (edit, publish, scan results) and gather what a scan reads (store name and description, About page, policies, brands, product types, collections) / WHY: the admin page, the AI scan and the storefront's agent endpoint share one store of facts, written inside RLS without touching other preferences. */
import { collection, page, product, store } from '@commerce/db'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { richTextToText } from '../blog/text'
import { notSystemTest } from '../catalog/system-test'
import type { StoreContext } from '../context'
import { parsePreferences } from '../online-store/preferences'
import { listPolicies } from '../policies/service'
import {
  type AgentKnowledge,
  cleanValue,
  factEntries,
  isEmptyKnowledge,
  type KnowledgeKey,
  type KnowledgeValueInput,
  knowledgeCounts,
  mergeDraft,
  parseAgentKnowledge,
} from './knowledge'

async function loadAgentKnowledge(ctx: StoreContext): Promise<AgentKnowledge> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseAgentKnowledge(s?.preferences)
}

/** The store's published facts as entries the Inbox AI agent can quote (see `factEntries`). */
export async function publishedFactEntries(
  ctx: StoreContext,
): Promise<{ title: string; answer: string }[]> {
  return factEntries(await loadAgentKnowledge(ctx))
}

async function saveKnowledge(ctx: StoreContext, next: AgentKnowledge): Promise<AgentKnowledge> {
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ agentKnowledge: next })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
  return next
}

/** The merchant's own words for one fact; empty removes it. Keeps its published state. */
export async function saveKnowledgeFact(
  ctx: StoreContext,
  key: KnowledgeKey,
  value: KnowledgeValueInput,
  now = new Date(),
): Promise<AgentKnowledge> {
  const k = await loadAgentKnowledge(ctx)
  const clean = cleanValue(key, value)
  const facts = { ...k.facts }
  if (isEmptyKnowledge(clean)) delete facts[key]
  else
    facts[key] = {
      ...clean,
      published: facts[key]?.published ?? false,
      source: 'merchant',
      updatedAt: now.toISOString(),
    }
  return saveKnowledge(ctx, { ...k, facts })
}

/** Publish or unpublish facts ("Publish all" passes a whole group). */
export async function publishKnowledgeFacts(
  ctx: StoreContext,
  keys: KnowledgeKey[],
  published: boolean,
): Promise<AgentKnowledge> {
  const k = await loadAgentKnowledge(ctx)
  const facts = { ...k.facts }
  for (const key of keys) {
    const fact = facts[key]
    if (fact) facts[key] = { ...fact, published }
  }
  return saveKnowledge(ctx, { ...k, facts })
}

/** A scan's drafts, merged so nothing the merchant published or wrote is overwritten. */
export async function applyKnowledgeDraft(
  ctx: StoreContext,
  draft: Partial<Record<KnowledgeKey, KnowledgeValueInput>>,
  now = new Date(),
): Promise<AgentKnowledge> {
  const k = await loadAgentKnowledge(ctx)
  return saveKnowledge(ctx, mergeDraft(k, draft, now.toISOString()))
}

export type KnowledgeSources = {
  storeName: string
  description: string
  aboutPage: string
  policies: { title: string; text: string }[]
  brands: { name: string; products: number }[]
  types: string[]
  collections: string[]
  sampleTitles: string[]
}

const TEXT_CAP = 3000

/** What a scan reads. Only the store's public content: no customer or order data. */
export async function loadKnowledgeSources(ctx: StoreContext): Promise<KnowledgeSources> {
  const live = and(eq(product.status, 'active'), notSystemTest, eq(product.isGiftCard, false))
  const [[s], about, policies, brands, types, collections, titles] = await Promise.all([
    ctx.tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, ctx.storeId)),
    ctx.tx
      .select({ title: page.title, body: page.body })
      .from(page)
      .where(and(isNotNull(page.publishedAt), sql`${page.handle} ~* '^(about|our-story|story)'`))
      .limit(1),
    listPolicies(ctx),
    ctx.tx
      .select({ name: product.vendor, n: sql<number>`count(*)::int` })
      .from(product)
      .where(and(live, isNotNull(product.vendor)))
      .groupBy(product.vendor)
      .orderBy(desc(sql`count(*)`))
      .limit(25),
    ctx.tx
      .select({ name: product.productType })
      .from(product)
      .where(and(live, isNotNull(product.productType)))
      .groupBy(product.productType)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    ctx.tx.select({ title: collection.title }).from(collection).limit(30),
    ctx.tx
      .select({ title: product.title })
      .from(product)
      .where(live)
      .orderBy(desc(product.createdAt))
      .limit(40),
  ])
  return {
    storeName: s?.name ?? '',
    description: parsePreferences(s?.preferences).seo.description ?? '',
    aboutPage: about[0] ? richTextToText(about[0].body).slice(0, TEXT_CAP) : '',
    policies: policies
      .filter((p) => p.published && p.body)
      .map((p) => ({ title: p.title, text: richTextToText(p.body).slice(0, TEXT_CAP) })),
    brands: brands
      .filter((b) => b.name?.trim())
      .map((b) => ({ name: String(b.name).trim(), products: b.n })),
    types: types.map((t) => String(t.name ?? '').trim()).filter(Boolean),
    collections: collections.map((c) => c.title),
    sampleTitles: titles.map((t) => t.title),
  }
}

export type KnowledgeOverview = AgentKnowledge & {
  counts: { published: number; total: number }
  policies: { type: string; title: string; published: boolean }[]
}

/** Agentic sales → Knowledge base: the facts, their counts and the store's policies. */
export async function loadKnowledgeOverview(ctx: StoreContext): Promise<KnowledgeOverview> {
  const [k, policies] = await Promise.all([loadAgentKnowledge(ctx), listPolicies(ctx)])
  return {
    ...k,
    counts: knowledgeCounts(k),
    policies: policies.map((p) => ({ type: p.type, title: p.title, published: p.published })),
  }
}
