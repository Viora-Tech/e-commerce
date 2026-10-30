/** SOURCE OF TRUTH: listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, setKnowledgePublished, reorderKnowledge, importedFactsSource, bringOverImportedFacts, publishedKnowledge — WHAT: the store's knowledge base (short answers the Inbox AI agent quotes when published) and the one-click copy of Shopify's imported "Knowledge Base Facts" entries / WHY: shipping time, warranty, returns and COD are asked all day, and the merchant decides which answers the AI may give (admin audit #134, #178). */
import { inboxKnowledge, metaobject, metaobjectDefinition, type StoreTx } from '@commerce/db'
import { asc, count, eq, isNotNull, max } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import {
  factFromMetaobject,
  isKnowledgeFactsDefinition,
  KNOWLEDGE_ANSWER_MAX,
  KNOWLEDGE_ENTRIES_MAX,
  KNOWLEDGE_TITLE_MAX,
} from './knowledge-rules'
import { InboxError } from './messages'

export const KnowledgeInputSchema = z.object({
  title: z.string().trim().min(1).max(KNOWLEDGE_TITLE_MAX),
  answer: z.string().trim().min(1).max(KNOWLEDGE_ANSWER_MAX),
  published: z.boolean().default(true),
})
export const KnowledgeUpdateSchema = KnowledgeInputSchema.extend({ id: z.uuid() })
export type KnowledgeInput = z.input<typeof KnowledgeInputSchema>

export type Knowledge = {
  id: string
  title: string
  answer: string
  published: boolean
  position: number
  /** Copied from an imported Shopify "Knowledge Base Facts" entry. */
  imported: boolean
}

const columns = {
  id: inboxKnowledge.id,
  title: inboxKnowledge.title,
  answer: inboxKnowledge.answer,
  published: inboxKnowledge.published,
  position: inboxKnowledge.position,
  sourceMetaobjectId: inboxKnowledge.sourceMetaobjectId,
}

type Row = { sourceMetaobjectId: string | null } & Omit<Knowledge, 'imported'>

const view = ({ sourceMetaobjectId, ...r }: Row): Knowledge => ({
  ...r,
  imported: sourceMetaobjectId !== null,
})

const notFound = (ctx: StoreContext) =>
  new InboxError('INBOX_NOT_FOUND', 'Knowledge base entry not found', ctx.storeId)

/** Every entry, in the store's order. */
export async function listKnowledge(ctx: StoreContext): Promise<Knowledge[]> {
  const rows = await ctx.tx
    .select(columns)
    .from(inboxKnowledge)
    .orderBy(asc(inboxKnowledge.position), asc(inboxKnowledge.title))
  return rows.map(view)
}

/** Published entries as the AI agent reads them, in the store's order. */
export function publishedKnowledge(tx: StoreTx): Promise<{ title: string; answer: string }[]> {
  return tx
    .select({ title: inboxKnowledge.title, answer: inboxKnowledge.answer })
    .from(inboxKnowledge)
    .where(eq(inboxKnowledge.published, true))
    .orderBy(asc(inboxKnowledge.position), asc(inboxKnowledge.title))
    .limit(KNOWLEDGE_ENTRIES_MAX)
}

async function entryCount(ctx: StoreContext): Promise<number> {
  const [row] = await ctx.tx.select({ n: count() }).from(inboxKnowledge)
  return row?.n ?? 0
}

async function nextPosition(ctx: StoreContext): Promise<number> {
  const [last] = await ctx.tx.select({ n: max(inboxKnowledge.position) }).from(inboxKnowledge)
  return (last?.n ?? -1) + 1
}

const full = (ctx: StoreContext) =>
  new InboxError(
    'INBOX_INVALID',
    `A knowledge base keeps up to ${KNOWLEDGE_ENTRIES_MAX} answers`,
    ctx.storeId,
  )

export async function createKnowledge(
  ctx: StoreContext,
  raw: KnowledgeInput,
  userId: string | null = null,
): Promise<Knowledge> {
  const input = KnowledgeInputSchema.parse(raw)
  if ((await entryCount(ctx)) >= KNOWLEDGE_ENTRIES_MAX) throw full(ctx)
  const [row] = await ctx.tx
    .insert(inboxKnowledge)
    .values({
      storeId: ctx.storeId,
      ...input,
      position: await nextPosition(ctx),
      createdBy: userId,
    })
    .returning(columns)
  return view(row as Row)
}

export async function updateKnowledge(
  ctx: StoreContext,
  raw: z.input<typeof KnowledgeUpdateSchema>,
): Promise<Knowledge> {
  const input = KnowledgeUpdateSchema.parse(raw)
  const [row] = await ctx.tx
    .update(inboxKnowledge)
    .set({
      title: input.title,
      answer: input.answer,
      published: input.published,
      updatedAt: new Date(),
    })
    .where(eq(inboxKnowledge.id, input.id))
    .returning(columns)
  if (!row) throw notFound(ctx)
  return view(row)
}

/** The list's publish switch. */
export async function setKnowledgePublished(
  ctx: StoreContext,
  input: { id: string; published: boolean },
): Promise<Knowledge> {
  const [row] = await ctx.tx
    .update(inboxKnowledge)
    .set({ published: input.published, updatedAt: new Date() })
    .where(eq(inboxKnowledge.id, input.id))
    .returning(columns)
  if (!row) throw notFound(ctx)
  return view(row)
}

export async function deleteKnowledge(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx
    .delete(inboxKnowledge)
    .where(eq(inboxKnowledge.id, id))
    .returning({ id: inboxKnowledge.id })
  if (gone.length === 0) throw notFound(ctx)
}

/** Puts the entries in the order of `ids` (position 0 first). */
export async function reorderKnowledge(ctx: StoreContext, ids: string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await ctx.tx.update(inboxKnowledge).set({ position }).where(eq(inboxKnowledge.id, id))
  }
}

/** Imported "Knowledge Base Facts" entries: how many there are and how many are still to copy. */
export type ImportedFactsSource = { definitionId: string; entries: number; remaining: number }

async function factsDefinition(ctx: StoreContext) {
  const defs = await ctx.tx
    .select({
      id: metaobjectDefinition.id,
      type: metaobjectDefinition.type,
      name: metaobjectDefinition.name,
    })
    .from(metaobjectDefinition)
  return defs.find(isKnowledgeFactsDefinition) ?? null
}

async function copiedIds(ctx: StoreContext): Promise<Set<string>> {
  const rows = await ctx.tx
    .select({ id: inboxKnowledge.sourceMetaobjectId })
    .from(inboxKnowledge)
    .where(isNotNull(inboxKnowledge.sourceMetaobjectId))
  return new Set(rows.flatMap((r) => (r.id ? [r.id] : [])))
}

/** The imported Shopify knowledge base, or null when the store has none. */
export async function importedFactsSource(ctx: StoreContext): Promise<ImportedFactsSource | null> {
  const def = await factsDefinition(ctx)
  if (!def) return null
  const entries = await ctx.tx
    .select({ id: metaobject.id })
    .from(metaobject)
    .where(eq(metaobject.definitionId, def.id))
  if (entries.length === 0) return null
  const copied = await copiedIds(ctx)
  return {
    definitionId: def.id,
    entries: entries.length,
    remaining: entries.filter((e) => !copied.has(e.id)).length,
  }
}

/**
 * Copies imported "Knowledge Base Facts" entries not copied before into the knowledge base.
 * Confirmed answers keep Shopify's published flag; Shopify's own suggestions come over as
 * drafts. Entries with no answer are skipped. Running it twice adds nothing.
 */
export async function bringOverImportedFacts(
  ctx: StoreContext,
  userId: string | null = null,
): Promise<{ added: number; skipped: number }> {
  const def = await factsDefinition(ctx)
  if (!def) return { added: 0, skipped: 0 }
  const entries = await ctx.tx
    .select({ id: metaobject.id, fields: metaobject.fields, status: metaobject.status })
    .from(metaobject)
    .where(eq(metaobject.definitionId, def.id))
    .orderBy(asc(metaobject.handle))
  const copied = await copiedIds(ctx)
  const fresh = entries.filter((e) => !copied.has(e.id))
  const room = KNOWLEDGE_ENTRIES_MAX - (await entryCount(ctx))
  let position = await nextPosition(ctx)
  const values: (typeof inboxKnowledge.$inferInsert)[] = []
  for (const e of fresh) {
    const fact = factFromMetaobject(e.fields, e.status)
    if (!fact || values.length >= room) continue
    values.push({
      storeId: ctx.storeId,
      ...fact,
      position: position++,
      sourceMetaobjectId: e.id,
      createdBy: userId,
    })
  }
  if (values.length > 0) {
    await ctx.tx.insert(inboxKnowledge).values(values).onConflictDoNothing()
  }
  return { added: values.length, skipped: fresh.length - values.length }
}

/** Counts for the Inbox home and the page header: "6 of 18 published". */
export async function knowledgeCounts(
  ctx: StoreContext,
): Promise<{ total: number; published: number }> {
  const rows = await ctx.tx
    .select({ published: inboxKnowledge.published, n: count() })
    .from(inboxKnowledge)
    .groupBy(inboxKnowledge.published)
  const total = rows.reduce((n, r) => n + r.n, 0)
  return { total, published: rows.find((r) => r.published)?.n ?? 0 }
}
