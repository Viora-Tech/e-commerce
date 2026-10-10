import { onHandleChange } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { page } from '@commerce/db'
import { desc, eq } from 'drizzle-orm'

export async function listPages(tx: StoreTx) {
  return tx
    .select({
      id: page.id,
      handle: page.handle,
      title: page.title,
      templateSuffix: page.templateSuffix,
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

const EMPTY_LAYOUT = { root: { props: {} }, content: [], zones: {} }

export async function createPage(
  tx: StoreTx,
  storeId: string,
  input: { handle: string; title: string; templateSuffix?: string | null | undefined },
) {
  const [p] = await tx
    .insert(page)
    .values({
      storeId,
      handle: input.handle,
      title: input.title,
      templateSuffix: input.templateSuffix || null,
      data: EMPTY_LAYOUT,
    })
    .returning()
  return p ?? null
}

export type PageUpdate = {
  title?: string | undefined
  handle?: string | undefined
  body?: unknown
  seoTitle?: string | null | undefined
  seoDescription?: string | null | undefined
  templateSuffix?: string | null | undefined
  visible?: boolean | undefined
}

/**
 * Page details: title, handle, content, SEO, visibility and its theme template.
 * The layout lives in the theme template (Customize), not on the page.
 */
export async function updatePage(tx: StoreTx, storeId: string, id: string, input: PageUpdate) {
  const [current] = await tx
    .select({ publishedAt: page.publishedAt, handle: page.handle })
    .from(page)
    .where(eq(page.id, id))
  if (!current) return null
  const { visible, templateSuffix, ...rest } = input
  const defined = Object.entries(rest).filter(([, v]) => v !== undefined)
  const set: Partial<typeof page.$inferInsert> = {
    ...(Object.fromEntries(defined) as Partial<typeof page.$inferInsert>),
    updatedAt: new Date(),
  }
  if (templateSuffix !== undefined) set.templateSuffix = templateSuffix || null
  if (visible !== undefined) set.publishedAt = visible ? (current.publishedAt ?? new Date()) : null
  const [p] = await tx.update(page).set(set).where(eq(page.id, id)).returning()
  // A new handle leaves a redirect behind and moves menu links with it.
  if (p) await onHandleChange(tx, storeId, 'page', current.handle, p.handle)
  return p ?? null
}

export async function deletePage(tx: StoreTx, id: string) {
  const rows = await tx.delete(page).where(eq(page.id, id)).returning({ id: page.id })
  return rows.length > 0
}
