/** SOURCE OF TRUTH: template assignments, templateAssignments, reassignTemplate — WHAT: which products, collections, pages, blogs and blog posts use each alternate template (`<kind>.<suffix>`), counted and moved / WHY: the template picker shows "Used by 3 products" and a rename must move those resources with it, and the five resource tables each keep their own `template_suffix` */
import { article, blog, collection, page, product, type StoreTx } from '@commerce/db'
import { count, eq, isNotNull } from 'drizzle-orm'
import type { AlternateKind, TemplateAssignments } from './templates-data'

const TABLES = { product, collection, page, blog, article } as const

/** Every alternate in use and how many resources use it (a resource with no suffix uses the default). */
export async function templateAssignments(tx: StoreTx): Promise<TemplateAssignments> {
  const entries = await Promise.all(
    (Object.keys(TABLES) as AlternateKind[]).map(async (kind) => {
      const table = TABLES[kind]
      const rows = await tx
        .select({ suffix: table.templateSuffix, n: count() })
        .from(table)
        .where(isNotNull(table.templateSuffix))
        .groupBy(table.templateSuffix)
      const bySuffix: Record<string, number> = {}
      for (const row of rows) if (row.suffix) bySuffix[row.suffix] = row.n
      return [kind, bySuffix] as const
    }),
  )
  return Object.fromEntries(entries) as TemplateAssignments
}

/**
 * Moves every resource of `kind` from one alternate to another (a renamed template). Returns
 * how many moved. Assignments are store-wide, so this follows the rename in every theme.
 */
export async function reassignTemplate(
  tx: StoreTx,
  kind: AlternateKind,
  from: string,
  to: string,
): Promise<number> {
  const table = TABLES[kind]
  const rows = await tx
    .update(table)
    .set({ templateSuffix: to })
    .where(eq(table.templateSuffix, from))
    .returning({ id: table.id })
  return rows.length
}
