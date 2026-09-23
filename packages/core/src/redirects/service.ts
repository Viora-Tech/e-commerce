import { type StoreTx, urlRedirect } from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { normaliseRedirectPath, type RedirectWrite } from './paths'

export type RedirectRow = typeof urlRedirect.$inferSelect

export type RedirectList = {
  page: number
  perPage: number
  query?: string | undefined
  sort?: 'path' | 'newest' | undefined
}

export class DuplicateRedirect extends CommerceError {
  constructor(path: string) {
    super('CONFLICT', `A redirect from ${path} already exists`)
  }
}

export async function listRedirects(tx: StoreTx, input: RedirectList) {
  const q = input.query?.trim()
  const where = q
    ? or(ilike(urlRedirect.path, `%${q}%`), ilike(urlRedirect.target, `%${q}%`))
    : undefined
  const [total] = await tx.select({ n: count() }).from(urlRedirect).where(where)
  const items = await tx
    .select()
    .from(urlRedirect)
    .where(where)
    .orderBy(
      input.sort === 'path' ? asc(urlRedirect.path) : desc(urlRedirect.createdAt),
      asc(urlRedirect.id),
    )
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: total?.n ?? 0 }
}

/** Create or edit one redirect. A second redirect from the same path is refused. */
export async function saveRedirect(
  tx: StoreTx,
  storeId: string,
  input: RedirectWrite & { id?: string | undefined },
): Promise<RedirectRow> {
  const [clash] = await tx
    .select({ id: urlRedirect.id })
    .from(urlRedirect)
    .where(
      and(eq(urlRedirect.path, input.path), input.id ? ne(urlRedirect.id, input.id) : undefined),
    )
  if (clash) throw new DuplicateRedirect(input.path)
  if (input.id) {
    const [row] = await tx
      .update(urlRedirect)
      .set({ path: input.path, target: input.target, updatedAt: new Date() })
      .where(eq(urlRedirect.id, input.id))
      .returning()
    if (!row) throw new CommerceError('NOT_FOUND', `Redirect ${input.id} not found`)
    return row
  }
  const [row] = await tx
    .insert(urlRedirect)
    .values({ storeId, path: input.path, target: input.target, source: 'manual' })
    .returning()
  if (!row) throw new CommerceError('INTERNAL', 'Redirect was not saved')
  return row
}

export async function deleteRedirects(tx: StoreTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .delete(urlRedirect)
    .where(inArray(urlRedirect.id, ids))
    .returning({ id: urlRedirect.id })
  return rows.length
}

/**
 * Write a redirect an import produced. A redirect the merchant created or
 * edited by hand wins: an imported one never overwrites a manual row.
 * Returns whether a row was created, updated, or left alone.
 */
export async function upsertImportedRedirect(
  tx: StoreTx,
  storeId: string,
  path: string,
  target: string,
): Promise<'created' | 'updated' | 'skipped'> {
  const from = normaliseRedirectPath(path)
  if (!from || from === '/') return 'skipped'
  const [existing] = await tx
    .select({ id: urlRedirect.id, source: urlRedirect.source, target: urlRedirect.target })
    .from(urlRedirect)
    .where(eq(urlRedirect.path, from))
  if (!existing) {
    await tx.insert(urlRedirect).values({ storeId, path: from, target, source: 'import' })
    return 'created'
  }
  if (existing.source === 'manual' || existing.target === target) return 'skipped'
  await tx
    .update(urlRedirect)
    .set({ target, updatedAt: new Date() })
    .where(eq(urlRedirect.id, existing.id))
  return 'updated'
}

/** The storefront's lookup: the target for one normalised path, or null. */
export async function findRedirect(tx: StoreTx, path: string): Promise<string | null> {
  const [row] = await tx
    .select({ target: urlRedirect.target })
    .from(urlRedirect)
    .where(eq(urlRedirect.path, normaliseRedirectPath(path)))
    .limit(1)
  return row?.target ?? null
}

/** Whether a store has any redirects, so the proxy can skip the lookup entirely when not. */
export async function hasRedirects(tx: StoreTx): Promise<boolean> {
  const [row] = await tx.select({ one: sql<number>`1` }).from(urlRedirect).limit(1)
  return Boolean(row)
}
