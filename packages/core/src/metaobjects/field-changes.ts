/** SOURCE OF TRUTH: content type field changes — WHAT which field edits a content type refuses once entries hold data in that field (what goes in it, one value vs several, the unit kind, the currency, a row field's kind) / WHY saved values were checked against the old type, so changing it would leave entries the storefront cannot read. */
import { metaobject, type StoreTx } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import type { FieldDefinition, FieldValidations } from './schemas'
import { validateFieldValue } from './validate'

/** Per field key, how many entries of the definition hold a value in it. */
export async function filledFieldKeys(
  tx: StoreTx,
  definitionId: string,
): Promise<Record<string, number>> {
  const rows = await tx
    .select({
      key: sql<string>`k.key`,
      n: sql<number>`count(*)::int`,
    })
    .from(metaobject)
    .innerJoin(sql`jsonb_object_keys(${metaobject.fields}) as k(key)`, sql`true`)
    .where(eq(metaobject.definitionId, definitionId))
    .groupBy(sql`k.key`)
  return Object.fromEntries(rows.map((r) => [r.key, r.n]))
}

/**
 * The field changes a definition update would make that its entries cannot take. A field
 * removed earlier and now added back under its old key is fine when every value still
 * saved under that key fits the new field.
 */
export async function storedFieldProblems(
  tx: StoreTx,
  definitionId: string,
  before: readonly FieldDefinition[],
  after: readonly FieldDefinition[],
): Promise<string[]> {
  const filled = await filledFieldKeys(tx, definitionId)
  const fits = new Set<string>()
  for (const field of after) {
    if (!filled[field.key] || before.some((f) => f.key === field.key)) continue
    const rows = await tx
      .select({ value: sql<unknown>`${metaobject.fields} -> ${field.key}` })
      .from(metaobject)
      .where(eq(metaobject.definitionId, definitionId))
    if (rows.every((r) => validateFieldValue({ ...field, required: false }, r.value).ok)) {
      fits.add(field.key)
    }
  }
  return fieldChangeProblems(before, after, filled, fits)
}

/** The parts of a field's rules that change how its saved values read. */
function shapeOf(rules: FieldValidations | undefined): string {
  return JSON.stringify({
    currency: rules?.currency ?? 'INR',
    measure: rules?.measure ?? null,
    rows: (rules?.subfields ?? []).map((s) => [s.key, s.type, s.validations?.measure ?? null]),
  })
}

const entries = (n: number) => (n === 1 ? '1 entry' : `${n} entries`)

/**
 * Why a new field list cannot replace the old one, given which keys hold data. A field
 * whose kind of value changes (or that is removed and added back under the same key as
 * something else) is refused while entries hold data in it. Row fields of a group may be
 * added or removed; changing one that rows already use is refused like a field.
 */
export function fieldChangeProblems(
  before: readonly FieldDefinition[],
  after: readonly FieldDefinition[],
  filled: Readonly<Record<string, number>>,
  /** Keys added back whose saved values all fit the new field. */
  fits: ReadonlySet<string> = new Set(),
): string[] {
  const problems: string[] = []
  const old = new Map(before.map((f) => [f.key, f]))
  for (const field of after) {
    const n = filled[field.key] ?? 0
    if (n === 0 || fits.has(field.key)) continue
    const was = old.get(field.key)
    if (!was) {
      problems.push(
        `${entries(n)} still hold old values under the key ${field.key}. Give ${field.name} another key`,
      )
      continue
    }
    const changed =
      was.type !== field.type ||
      was.list !== field.list ||
      (was.type !== 'group' && shapeOf(was.validations) !== shapeOf(field.validations)) ||
      (was.type === 'group' && groupRowChanged(was.validations, field.validations))
    if (changed) {
      problems.push(
        `${field.name} already has values in ${entries(n)}, so what goes in it cannot change. Add a new field instead, or clear it in those entries first`,
      )
    }
  }
  return problems
}

/** A row field kept under the same key but holding a different kind of value. */
function groupRowChanged(
  before: FieldValidations | undefined,
  after: FieldValidations | undefined,
): boolean {
  const old = new Map((before?.subfields ?? []).map((s) => [s.key, s]))
  return (after?.subfields ?? []).some((s) => {
    const was = old.get(s.key)
    return (
      was !== undefined &&
      (was.type !== s.type || shapeOf(was.validations) !== shapeOf(s.validations))
    )
  })
}
