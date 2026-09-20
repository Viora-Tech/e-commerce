import type { StoreTx } from '@commerce/db'
import { page } from '@commerce/db'
import { desc, eq } from 'drizzle-orm'

export async function listPages(tx: StoreTx) {
  return tx
    .select({
      id: page.id,
      handle: page.handle,
      title: page.title,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    })
    .from(page)
    .orderBy(desc(page.updatedAt))
}

export async function getPage(tx: StoreTx, id: string) {
  const [p] = await tx.select().from(page).where(eq(page.id, id))
  return p ?? null
}

export async function getPublishedPageByHandle(tx: StoreTx, handle: string) {
  const [p] = await tx
    .select({ id: page.id, title: page.title, publishedData: page.publishedData })
    .from(page)
    .where(eq(page.handle, handle))
  return p?.publishedData ? { id: p.id, title: p.title, data: p.publishedData } : null
}

export async function createPage(
  tx: StoreTx,
  storeId: string,
  input: { handle: string; title: string; data: unknown },
) {
  const [p] = await tx
    .insert(page)
    .values({ storeId, handle: input.handle, title: input.title, data: input.data })
    .returning()
  return p ?? null
}

export async function saveDraft(
  tx: StoreTx,
  id: string,
  input: { title?: string | undefined; data: unknown },
) {
  const set: { data: unknown; updatedAt: Date; title?: string } = {
    data: input.data,
    updatedAt: new Date(),
  }
  if (input.title !== undefined) set.title = input.title
  const [p] = await tx.update(page).set(set).where(eq(page.id, id)).returning()
  return p ?? null
}

/** Copies the draft to publishedData. The storefront renders publishedData only. */
export async function publishPage(tx: StoreTx, id: string) {
  const [p] = await tx.select().from(page).where(eq(page.id, id))
  if (!p) return null
  const [updated] = await tx
    .update(page)
    .set({ publishedData: p.data, publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(page.id, id))
    .returning()
  return updated ?? null
}

export async function deletePage(tx: StoreTx, id: string) {
  const rows = await tx.delete(page).where(eq(page.id, id)).returning({ id: page.id })
  return rows.length > 0
}
