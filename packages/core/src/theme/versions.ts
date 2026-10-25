/** SOURCE OF TRUTH: theme version history — WHAT snapshots of a theme's saved templates each time it goes live (published, or a live theme saved), the newest 20 per template, listing them, previewing one, and restoring one into the drafts / WHY a merchant can see and undo what went live without anything ever being republished behind their back. */
import { newId, type StoreTx, theme, themeTemplate, themeVersion } from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ThemeLibraryError } from './library'
import {
  defaultTemplate,
  parseTemplateData,
  type TemplateData,
  type TemplateKey,
} from './templates-data'

/** Versions kept per template of a theme; older ones are removed when a new one is taken. */
export const VERSIONS_KEPT = 20

export type VersionReason = 'publish' | 'save'

/** One publish or save: when, by whom, why, and which templates it holds. */
export type ThemeVersionBatch = {
  batchId: string
  reason: VersionReason
  createdAt: Date
  createdBy: string | null
  templates: { template: TemplateKey; suffix: string }[]
}

/**
 * Copies every saved template of a theme into its history as one batch, then keeps only the
 * newest `VERSIONS_KEPT` per template. Returns the batch id, or null when the theme has no
 * saved templates yet (it still renders its code defaults; nothing to remember).
 */
export async function snapshotTheme(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; reason: VersionReason; by?: string | undefined },
): Promise<string | null> {
  const rows = await tx
    .select({
      template: themeTemplate.template,
      suffix: themeTemplate.suffix,
      sections: themeTemplate.sections,
    })
    .from(themeTemplate)
    .where(eq(themeTemplate.themeId, input.themeId))
  if (!rows.length) return null
  const batchId = newId()
  await tx.insert(themeVersion).values(
    rows.map((r) => ({
      id: newId(),
      storeId,
      themeId: input.themeId,
      batchId,
      reason: input.reason,
      template: r.template,
      suffix: r.suffix,
      sections: r.sections,
      createdBy: input.by ?? null,
    })),
  )
  // Keep the newest VERSIONS_KEPT per template: number them newest first, drop the rest.
  await tx.execute(sql`
    delete from ${themeVersion} where ${themeVersion.id} in (
      select id from (
        select id, row_number() over (
          partition by template, suffix order by created_at desc, id desc
        ) as n
        from ${themeVersion} where ${themeVersion.themeId} = ${input.themeId}
      ) ranked where n > ${VERSIONS_KEPT}
    )`)
  return batchId
}

/** A theme's history, newest first, one entry per publish or save. */
export async function listThemeVersions(
  tx: StoreTx,
  themeId: string,
): Promise<ThemeVersionBatch[]> {
  const rows = await tx
    .select({
      batchId: themeVersion.batchId,
      reason: themeVersion.reason,
      createdAt: themeVersion.createdAt,
      createdBy: themeVersion.createdBy,
      template: themeVersion.template,
      suffix: themeVersion.suffix,
    })
    .from(themeVersion)
    .where(eq(themeVersion.themeId, themeId))
    .orderBy(desc(themeVersion.createdAt), themeVersion.template, themeVersion.suffix)
  const batches = new Map<string, ThemeVersionBatch>()
  for (const r of rows) {
    let batch = batches.get(r.batchId)
    if (!batch) {
      batch = {
        batchId: r.batchId,
        reason: r.reason === 'publish' ? 'publish' : 'save',
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        templates: [],
      }
      batches.set(r.batchId, batch)
    }
    batch.templates.push({ template: r.template as TemplateKey, suffix: r.suffix })
  }
  return [...batches.values()]
}

/** A template as one version saved it (the storefront's version preview); null when not in it. */
export async function versionTemplate(
  tx: StoreTx,
  input: { themeId: string; batchId: string; template: TemplateKey; suffix: string },
): Promise<TemplateData | null> {
  const [row] = await tx
    .select({ sections: themeVersion.sections })
    .from(themeVersion)
    .where(
      and(
        eq(themeVersion.themeId, input.themeId),
        eq(themeVersion.batchId, input.batchId),
        eq(themeVersion.template, input.template),
        eq(themeVersion.suffix, input.suffix),
      ),
    )
  return row ? parseTemplateData(row.sections) : null
}

/**
 * Puts a version back as the theme's drafts, template by template: Customize and previews show
 * it, shoppers see nothing until the merchant saves (and, for an unpublished theme, publishes).
 * A template the theme no longer has is created from the version. Returns how many templates.
 */
export async function restoreThemeVersion(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; batchId: string },
): Promise<number> {
  const [found] = await tx.select({ id: theme.id }).from(theme).where(eq(theme.id, input.themeId))
  if (!found) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${input.themeId}`)
  const rows = await tx
    .select({
      template: themeVersion.template,
      suffix: themeVersion.suffix,
      sections: themeVersion.sections,
    })
    .from(themeVersion)
    .where(and(eq(themeVersion.themeId, input.themeId), eq(themeVersion.batchId, input.batchId)))
  if (!rows.length) throw new ThemeLibraryError('THEME_NOT_FOUND', 'That version no longer exists')
  const existing = await tx
    .select({
      id: themeTemplate.id,
      template: themeTemplate.template,
      suffix: themeTemplate.suffix,
    })
    .from(themeTemplate)
    .where(
      and(
        eq(themeTemplate.themeId, input.themeId),
        inArray(
          themeTemplate.template,
          rows.map((r) => r.template),
        ),
      ),
    )
  for (const r of rows) {
    const row = existing.find((e) => e.template === r.template && e.suffix === r.suffix)
    if (row) {
      await tx
        .update(themeTemplate)
        .set({ draft: r.sections, updatedAt: new Date() })
        .where(eq(themeTemplate.id, row.id))
    } else {
      await tx.insert(themeTemplate).values({
        id: newId(),
        storeId,
        themeId: input.themeId,
        template: r.template,
        suffix: r.suffix,
        // Saved stays the code default: only the draft holds the version until Save.
        sections: defaultTemplate(r.template as TemplateKey),
        draft: r.sections,
      })
    }
  }
  return rows.length
}
