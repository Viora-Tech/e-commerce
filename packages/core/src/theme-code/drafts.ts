/** SOURCE OF TRUTH: one publish for a theme's two kinds of drafts — WHAT: counts what a theme has saved but not put live (Customize's template drafts, Edit code's unpublished files) and puts both live in one go / WHY: an imported theme keeps its code and its templates in separate stores, and the owner asked why one change needed Edit code → Publish and then Customize → Save; one action, one version entry */
import { type StoreTx, themeFile, themeTemplate } from '@commerce/db'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { getTheme, touchTheme } from '../theme/library'
import { commitTemplateDrafts } from '../theme/templates'
import { snapshotTheme } from '../theme/versions'
import { publishCodeDrafts } from './files'

/** What a theme has saved as drafts: templates in Customize, files in Edit code (imported only). */
export type ThemeDraftCounts = { templates: number; code: number }

export type ThemeDraftsPublished = {
  /** Templates whose Customize drafts became their saved sections. */
  saved: number
  /** Edit code files that went live. */
  published: number
  /** The version history entry this publish added (live theme with saved templates), else null. */
  versionId: string | null
}

/** How many templates and code files of a theme wait for Save / Publish. */
export async function themeDraftCounts(tx: StoreTx, themeId: string): Promise<ThemeDraftCounts> {
  const [templates] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(themeTemplate)
    .where(and(eq(themeTemplate.themeId, themeId), isNotNull(themeTemplate.draft)))
  const [code] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(themeFile)
    .where(and(eq(themeFile.themeId, themeId), isNotNull(themeFile.draftBody)))
  return { templates: templates?.n ?? 0, code: code?.n ?? 0 }
}

/**
 * Customize's Save and Edit code's Publish, as one step: every template draft becomes saved and
 * every unpublished file goes live, in the caller's transaction, so a broken file or a template
 * whose connected source is gone stops both. A live theme gets one version history entry for
 * the whole publish (the templates it now has), never one per screen.
 */
export async function publishThemeDrafts(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; by?: string | undefined },
): Promise<ThemeDraftsPublished> {
  const saved = await commitTemplateDrafts(tx, input.themeId)
  const { published } = await publishCodeDrafts(tx, storeId, input)
  if (saved > 0) await touchTheme(tx, input.themeId, input.by)
  const live = (await getTheme(tx, input.themeId))?.role === 'main'
  const versionId =
    live && saved > 0
      ? await snapshotTheme(tx, storeId, { themeId: input.themeId, reason: 'save', by: input.by })
      : null
  return { saved, published, versionId }
}
