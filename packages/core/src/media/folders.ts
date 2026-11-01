/** SOURCE OF TRUTH: Files folders (#91) — WHAT create, rename, delete (only when empty) and list folders, and move files into or out of one / WHY a store with hundreds of imported files needs somewhere to sort them; folders never touch a file's key or URL */
import type { StoreTx } from '@commerce/db'
import { media, mediaFolder, newId } from '@commerce/db'
import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { CommerceError } from '../errors'
import { USABLE_MEDIA_STATUSES } from './usage'

export const MediaFolderNameSchema = z.string().trim().min(1).max(60)

/** Most files moved in one call: a page of the library at its largest. */
export const MOVE_MEDIA_MAX = 250

export class MediaFolderError extends CommerceError {
  constructor(
    code: 'MEDIA_FOLDER_NOT_FOUND' | 'MEDIA_FOLDER_TAKEN' | 'MEDIA_FOLDER_NOT_EMPTY',
    message: string,
  ) {
    super(code, message)
  }
}

export type MediaFolderRow = { id: string; name: string; files: number }

/** The store's folders by name, each with how many listed files it holds. */
export async function listMediaFolders(tx: StoreTx): Promise<MediaFolderRow[]> {
  const rows = await tx
    .select({
      id: mediaFolder.id,
      name: mediaFolder.name,
      files: sql<number>`count(${media.id})::int`,
    })
    .from(mediaFolder)
    .leftJoin(
      media,
      and(eq(media.folderId, mediaFolder.id), inArray(media.status, USABLE_MEDIA_STATUSES)),
    )
    .groupBy(mediaFolder.id, mediaFolder.name)
    .orderBy(asc(sql`lower(${mediaFolder.name})`))
  return rows.map((r) => ({ ...r, files: Number(r.files) }))
}

async function assertNameFree(tx: StoreTx, name: string, exceptId?: string) {
  const [taken] = await tx
    .select({ id: mediaFolder.id })
    .from(mediaFolder)
    .where(
      and(
        sql`lower(${mediaFolder.name}) = lower(${name})`,
        exceptId ? ne(mediaFolder.id, exceptId) : undefined,
      ),
    )
    .limit(1)
  if (taken) {
    throw new MediaFolderError('MEDIA_FOLDER_TAKEN', `A folder named "${name}" already exists`)
  }
}

export async function createMediaFolder(
  tx: StoreTx,
  storeId: string,
  rawName: string,
): Promise<MediaFolderRow> {
  const name = MediaFolderNameSchema.parse(rawName)
  await assertNameFree(tx, name)
  const id = newId()
  await tx.insert(mediaFolder).values({ id, storeId, name })
  return { id, name, files: 0 }
}

export async function renameMediaFolder(tx: StoreTx, id: string, rawName: string) {
  const name = MediaFolderNameSchema.parse(rawName)
  await assertNameFree(tx, name, id)
  const [row] = await tx
    .update(mediaFolder)
    .set({ name })
    .where(eq(mediaFolder.id, id))
    .returning({ id: mediaFolder.id, name: mediaFolder.name })
  if (!row) throw new MediaFolderError('MEDIA_FOLDER_NOT_FOUND', 'This folder was not found')
  return row
}

/** Deletes an empty folder; one still holding files (any status) is refused with how many. */
export async function deleteMediaFolder(tx: StoreTx, id: string) {
  const [held] = await tx.select({ n: count() }).from(media).where(eq(media.folderId, id))
  const files = Number(held?.n ?? 0)
  if (files > 0) {
    throw new MediaFolderError(
      'MEDIA_FOLDER_NOT_EMPTY',
      `This folder still holds ${files} file${files === 1 ? '' : 's'}. Move or delete them first.`,
    )
  }
  const [row] = await tx
    .delete(mediaFolder)
    .where(eq(mediaFolder.id, id))
    .returning({ id: mediaFolder.id })
  if (!row) throw new MediaFolderError('MEDIA_FOLDER_NOT_FOUND', 'This folder was not found')
  return { ok: true as const }
}

/** Puts files in a folder, or takes them out of any with `folderId` null. Returns how many moved. */
export async function moveMediaToFolder(
  tx: StoreTx,
  ids: readonly string[],
  folderId: string | null,
): Promise<{ moved: number }> {
  if (ids.length === 0) return { moved: 0 }
  if (folderId) {
    const [folder] = await tx
      .select({ id: mediaFolder.id })
      .from(mediaFolder)
      .where(eq(mediaFolder.id, folderId))
    if (!folder) throw new MediaFolderError('MEDIA_FOLDER_NOT_FOUND', 'This folder was not found')
  }
  const rows = await tx
    .update(media)
    .set({ folderId })
    .where(inArray(media.id, [...ids]))
    .returning({ id: media.id })
  return { moved: rows.length }
}
