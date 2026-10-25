/** SOURCE OF TRUTH: affiliate creatives — WHAT: the images and captions a merchant gives affiliates to post, per program or for all, listed in the admin and on the affiliate dashboard / WHY: creators post more when the store hands them ready-made assets (design §5 Creatives) */
import { media, type StoreTx } from '@commerce/db'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { affiliateCreative } from './schema'
import { AffiliateError } from './store-settings'

export type Creative = {
  id: string
  programId: string | null
  mediaId: string
  url: string
  contentType: string | null
  title: string
  caption: string
  sort: number
  archivedAt: Date | null
}

/**
 * Creatives in order. `programId` narrows to that program's plus the all-programs ones (the
 * dashboard); without it every one is listed (the admin). Archived ones only when asked.
 */
export async function listCreatives(
  tx: StoreTx,
  opts: { programId?: string | undefined; archived?: boolean | undefined } = {},
): Promise<Creative[]> {
  const c = affiliateCreative
  return tx
    .select({
      id: c.id,
      programId: c.programId,
      mediaId: c.mediaId,
      url: media.url,
      contentType: media.contentType,
      title: c.title,
      caption: c.caption,
      sort: c.sort,
      archivedAt: c.archivedAt,
    })
    .from(c)
    .innerJoin(media, eq(media.id, c.mediaId))
    .where(
      and(
        opts.archived ? undefined : isNull(c.archivedAt),
        opts.programId ? or(isNull(c.programId), eq(c.programId, opts.programId)) : undefined,
      ),
    )
    .orderBy(asc(c.sort), asc(c.createdAt))
}

export type CreativeInput = {
  id?: string | undefined
  mediaId: string
  programId: string | null
  title: string
  caption: string
}

/** Adds a creative at the end, or saves one. */
export async function saveCreative(
  tx: StoreTx,
  storeId: string,
  input: CreativeInput,
): Promise<{ id: string }> {
  const values = {
    mediaId: input.mediaId,
    programId: input.programId,
    title: input.title.trim().slice(0, 120),
    caption: input.caption.trim().slice(0, 2200),
  }
  if (input.id) {
    const [row] = await tx
      .update(affiliateCreative)
      .set(values)
      .where(eq(affiliateCreative.id, input.id))
      .returning({ id: affiliateCreative.id })
    if (!row) throw new AffiliateError('CREATIVE_NOT_FOUND', 'Creative not found')
    return row
  }
  const existing = await tx.select({ sort: affiliateCreative.sort }).from(affiliateCreative)
  const sort = existing.reduce((m, r) => Math.max(m, r.sort + 1), 0)
  const [row] = await tx
    .insert(affiliateCreative)
    .values({ storeId, ...values, sort })
    .returning({ id: affiliateCreative.id })
  if (!row) throw new AffiliateError('CREATIVE_NOT_FOUND', 'Creative not saved')
  return row
}

/** Hides a creative from dashboards; restoring brings it back. */
export async function archiveCreative(tx: StoreTx, id: string, archived: boolean): Promise<void> {
  await tx
    .update(affiliateCreative)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(affiliateCreative.id, id))
}
