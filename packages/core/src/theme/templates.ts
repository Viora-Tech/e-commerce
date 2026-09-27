import { newId, type StoreTx, theme, themeTemplate } from '@commerce/db'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { bindingProblems } from '../dynamic-sources/format'
import { assertTemplateBindings, InvalidBindings } from '../dynamic-sources/service'
import { ThemeLibraryError } from './library'
import {
  defaultTemplate,
  parseTemplateData,
  stableTemplateJson,
  stripResolved,
  TEMPLATE_SUFFIX,
  type TemplateData,
  type TemplateKey,
} from './templates-data'

/**
 * Theme templates on the server. Rows are created lazily: a template with no row
 * renders its code default, so only what a merchant touched is stored. Edits
 * land in `draft` (the preview shows them) until Save copies them to `sections`,
 * which is all the live storefront ever reads.
 */

export type TemplateSummary = {
  template: TemplateKey
  suffix: string
  hasDraft: boolean
  updatedAt: Date
}

export type LoadedTemplate = {
  template: TemplateKey
  suffix: string
  data: TemplateData
  /** True when `data` is an unsaved draft. */
  draft: boolean
  /** False when nothing is stored and `data` is the code default. */
  stored: boolean
}

function assertSuffix(suffix: string): void {
  if (!TEMPLATE_SUFFIX.test(suffix)) {
    throw new ThemeLibraryError(
      'THEME_NAME_INVALID',
      'Template names use lowercase letters, numbers and hyphens',
    )
  }
}

async function assertTheme(tx: StoreTx, themeId: string): Promise<void> {
  const [row] = await tx.select({ id: theme.id }).from(theme).where(eq(theme.id, themeId))
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${themeId}`)
}

async function findRow(tx: StoreTx, themeId: string, key: TemplateKey, suffix: string) {
  const [row] = await tx
    .select()
    .from(themeTemplate)
    .where(
      and(
        eq(themeTemplate.themeId, themeId),
        eq(themeTemplate.template, key),
        eq(themeTemplate.suffix, suffix),
      ),
    )
  return row ?? null
}

/** Every stored template of a theme, for the editor's template picker. */
export async function listTemplates(tx: StoreTx, themeId: string): Promise<TemplateSummary[]> {
  const rows = await tx
    .select({
      template: themeTemplate.template,
      suffix: themeTemplate.suffix,
      hasDraft: sql<boolean>`${themeTemplate.draft} is not null`,
      updatedAt: themeTemplate.updatedAt,
    })
    .from(themeTemplate)
    .where(eq(themeTemplate.themeId, themeId))
    .orderBy(themeTemplate.template, themeTemplate.suffix)
  return rows.map((r) => ({ ...r, template: r.template as TemplateKey }))
}

/**
 * The template to render. An alternate that no longer exists falls back to the
 * default template, and a default with no row to the code default. `withDraft`
 * is for the editor and the preview only.
 */
export async function loadTemplate(
  tx: StoreTx,
  themeId: string,
  key: TemplateKey,
  suffix = '',
  options: { withDraft?: boolean } = {},
): Promise<LoadedTemplate> {
  const row =
    (suffix ? await findRow(tx, themeId, key, suffix) : null) ??
    (await findRow(tx, themeId, key, ''))
  if (!row) {
    return { template: key, suffix: '', data: defaultTemplate(key), draft: false, stored: false }
  }
  const draft = options.withDraft ? parseTemplateData(row.draft) : null
  return {
    template: key,
    suffix: row.suffix,
    data: draft ?? parseTemplateData(row.sections) ?? defaultTemplate(key),
    draft: draft !== null,
    stored: true,
  }
}

/** The live theme's id, or null for a store that has none yet. */
export async function mainThemeId(tx: StoreTx): Promise<string | null> {
  const [row] = await tx.select({ id: theme.id }).from(theme).where(eq(theme.role, 'main'))
  return row?.id ?? null
}

/** Stores an unsaved edit. A template with no row gets one, its saved state the default. */
export async function saveTemplateDraft(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; template: TemplateKey; suffix: string; data: TemplateData },
): Promise<void> {
  assertSuffix(input.suffix)
  await assertTheme(tx, input.themeId)
  // Drafts get the cheap checks (shape, scope, fixed-field types); Save checks the store's sources.
  const problems = bindingProblems(input.data, input.template)
  if (problems.length) throw new ThemeLibraryError('THEME_SOURCE_INVALID', problems.join('. '))
  const existing = await findRow(tx, input.themeId, input.template, input.suffix)
  if (existing) {
    // A draft that matches the saved template is no edit: store none, so Save has nothing to do.
    const saved = parseTemplateData(existing.sections)
    const same =
      saved !== null &&
      stableTemplateJson(stripResolved(saved)) === stableTemplateJson(stripResolved(input.data))
    await tx
      .update(themeTemplate)
      .set({ draft: same ? null : input.data, updatedAt: new Date() })
      .where(eq(themeTemplate.id, existing.id))
    return
  }
  if (input.suffix) {
    throw new ThemeLibraryError('THEME_NOT_FOUND', 'Create the template before editing it')
  }
  await tx.insert(themeTemplate).values({
    id: newId(),
    storeId,
    themeId: input.themeId,
    template: input.template,
    suffix: '',
    sections: defaultTemplate(input.template),
    draft: input.data,
  })
}

/**
 * Save: every draft of the theme becomes its saved sections. Returns how many
 * changed. Refused when a connected setting reads a source this store no longer
 * has (a deleted metafield, a hidden metaobject), so nothing half-saves.
 */
export async function commitTemplateDrafts(tx: StoreTx, themeId: string): Promise<number> {
  const drafts = await tx
    .select({ template: themeTemplate.template, draft: themeTemplate.draft })
    .from(themeTemplate)
    .where(and(eq(themeTemplate.themeId, themeId), isNotNull(themeTemplate.draft)))
  try {
    await assertTemplateBindings(
      tx,
      drafts.flatMap((d) => {
        const data = parseTemplateData(d.draft)
        return data ? [{ template: d.template, data }] : []
      }),
    )
  } catch (err) {
    if (err instanceof InvalidBindings) {
      throw new ThemeLibraryError('THEME_SOURCE_INVALID', err.problems.join('. '))
    }
    throw err
  }
  const rows = await tx
    .update(themeTemplate)
    .set({ sections: sql`${themeTemplate.draft}`, draft: null, updatedAt: new Date() })
    .where(and(eq(themeTemplate.themeId, themeId), isNotNull(themeTemplate.draft)))
    .returning({ id: themeTemplate.id })
  return rows.length
}

/** Throws away every unsaved edit of the theme. */
export async function discardTemplateDrafts(tx: StoreTx, themeId: string): Promise<void> {
  await tx
    .update(themeTemplate)
    .set({ draft: null })
    .where(and(eq(themeTemplate.themeId, themeId), isNotNull(themeTemplate.draft)))
}

/**
 * Shopify's "Create template": a new alternate such as `product.preorder`,
 * starting as a copy of the template it is based on (the default when blank).
 */
export async function createTemplateAlternate(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; template: TemplateKey; suffix: string; basedOn?: string | undefined },
): Promise<LoadedTemplate> {
  if (!input.suffix) {
    throw new ThemeLibraryError('THEME_NAME_INVALID', 'Give the template a name')
  }
  assertSuffix(input.suffix)
  await assertTheme(tx, input.themeId)
  if (await findRow(tx, input.themeId, input.template, input.suffix)) {
    throw new ThemeLibraryError('THEME_NAME_INVALID', 'A template with that name already exists')
  }
  const source = await loadTemplate(tx, input.themeId, input.template, input.basedOn ?? '', {
    withDraft: true,
  })
  await tx.insert(themeTemplate).values({
    id: newId(),
    storeId,
    themeId: input.themeId,
    template: input.template,
    suffix: input.suffix,
    sections: source.data,
  })
  return { ...source, suffix: input.suffix, draft: false, stored: true }
}

/** Deletes an alternate. Resources assigned to it fall back to the default template. */
export async function deleteTemplateAlternate(
  tx: StoreTx,
  input: { themeId: string; template: TemplateKey; suffix: string },
): Promise<void> {
  if (!input.suffix) {
    throw new ThemeLibraryError('THEME_LIVE', 'The default template cannot be deleted')
  }
  await tx
    .delete(themeTemplate)
    .where(
      and(
        eq(themeTemplate.themeId, input.themeId),
        eq(themeTemplate.template, input.template),
        eq(themeTemplate.suffix, input.suffix),
      ),
    )
}

/** Copies a theme's saved templates onto another (duplicate, new theme from a preset). */
export async function copyTemplates(
  tx: StoreTx,
  storeId: string,
  fromThemeId: string,
  toThemeId: string,
): Promise<void> {
  const rows = await tx
    .select({
      template: themeTemplate.template,
      suffix: themeTemplate.suffix,
      sections: themeTemplate.sections,
    })
    .from(themeTemplate)
    .where(eq(themeTemplate.themeId, fromThemeId))
  if (rows.length === 0) return
  await tx
    .insert(themeTemplate)
    .values(rows.map((r) => ({ ...r, id: newId(), storeId, themeId: toThemeId })))
    .onConflictDoNothing()
}
