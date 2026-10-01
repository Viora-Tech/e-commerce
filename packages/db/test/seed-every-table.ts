import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Db } from '../src/client'
import type { StoreTx } from '../src/with-store'

type Exec = Db | StoreTx

/**
 * Test helper: puts at least one row in EVERY table that has a `store_id`, for one store,
 * without knowing the schema in advance. It reads the catalogue (columns, foreign keys,
 * check constraints), seeds parents before children, and fills each column with a value
 * that satisfies its type and its `in (...)` checks, pointing foreign keys at the rows it
 * already made for the same store. A table added next month is covered automatically.
 *
 * Used by the cross-store leak guardrail (api) and the store export/delete tests (core):
 * both need "store B has a row in every table" so that any id of store B showing up for
 * store A is a real leak, not luck. Rows are shaped to pass constraints, not to make
 * business sense; tests that need realistic data seed it by hand on top.
 *
 * Runs on the OWNER connection (RLS does not apply). Each row goes in its own transaction:
 * a table whose constraints the generator cannot satisfy is reported in `failed` instead
 * of aborting the run, and callers assert that list stays short.
 */

type Column = {
  table: string
  name: string
  type: string
  notNull: boolean
  hasDefault: boolean
  generated: boolean
}

type ForeignKey = { child: string; column: string; parent: string; parentColumn: string }

export type SeededStore = {
  storeId: string
  /** Every `id` this run inserted, by table (tables without an `id` column are absent). */
  ids: Map<string, string[]>
  /** Tables that got a row. */
  seeded: string[]
  /** Tables the generator could not fill, with the database's reason. */
  failed: { table: string; error: string }[]
}

export type SeedEveryTableOptions = {
  /** Existing rows to point foreign keys to non-store tables at, e.g. `{ user: userId, organization: orgId }`. */
  globals?: Record<string, string> | undefined
  /** Rows per table (default 1). Two makes list endpoints return more than one item. */
  rowsPerTable?: number | undefined
}

const token = () => `s${randomUUID().replace(/-/g, '').slice(0, 12)}`

async function catalogue(db: Db) {
  const tables = (
    await db.execute<{ name: string }>(sql`
      select c.relname as name from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where c.relkind = 'r' and exists (
        select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'store_id' and not a.attisdropped
      )
      order by 1`)
  ).map((r) => r.name)

  const columns = await db.execute<Column>(sql`
    select c.relname as "table", a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
           a.attnotnull as "notNull", (ad.adbin is not null or a.attidentity <> '') as "hasDefault",
           (a.attgenerated <> '') as generated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`)

  const fks = await db.execute<ForeignKey>(sql`
    select child.relname as child, ca.attname as column, parent.relname as parent, pa.attname as "parentColumn"
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace n on n.oid = child.relnamespace and n.nspname = 'public'
    join pg_attribute ca on ca.attrelid = con.conrelid and ca.attnum = con.conkey[1]
    join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = con.confkey[1]
    where con.contype = 'f' and array_length(con.conkey, 1) = 1`)

  const checks = await db.execute<{ table: string; def: string }>(sql`
    select conrelid::regclass::text as "table", pg_get_constraintdef(oid) as def
    from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace`)

  return { tables, columns, fks, checks }
}

/** `col in ('a', 'b')` checks, as the first allowed literal per `table.column`. */
function allowedLiterals(checks: { table: string; def: string }[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of checks) {
    const table = c.table.replace(/"/g, '')
    const re = /\(?(\w+) = ANY \(ARRAY\['([^']*)'/g
    for (const m of c.def.matchAll(re)) {
      const key = `${table}.${m[1]}`
      if (!out.has(key)) out.set(key, m[2] as string)
    }
    const eqRe = /\(?(\w+) = '([^']*)'::text/g
    for (const m of c.def.matchAll(eqRe)) {
      const key = `${table}.${m[1]}`
      if (!out.has(key)) out.set(key, m[2] as string)
    }
  }
  return out
}

function valueFor(col: Column): unknown {
  const t = col.type
  if (t === 'uuid') return randomUUID()
  if (t.endsWith('[]')) return sql`'{}'`
  if (t === 'integer' || t === 'bigint' || t === 'smallint' || t.startsWith('numeric')) return 1
  if (t === 'boolean') return false
  if (t === 'jsonb' || t === 'json') return sql`'{}'::jsonb`
  if (t.startsWith('timestamp')) return sql`now()`
  if (t === 'date') return '2026-01-01'
  if (col.name.includes('email')) return `${token()}@example.test`
  return token()
}

/** Parents before children among the store tables. */
function seedOrder(tables: string[], fks: ForeignKey[]): string[] {
  const set = new Set(tables)
  const parentsOf = new Map(tables.map((t) => [t, new Set<string>()]))
  for (const fk of fks) {
    if (set.has(fk.child) && set.has(fk.parent) && fk.child !== fk.parent) {
      parentsOf.get(fk.child)?.add(fk.parent)
    }
  }
  const order: string[] = []
  const left = new Set(tables)
  while (left.size > 0) {
    const ready = [...left].filter((t) => [...(parentsOf.get(t) ?? [])].every((p) => !left.has(p)))
    // A cycle: seed the rest anyway; nullable FKs are skipped when the parent is missing.
    const batch = ready.length > 0 ? ready.sort() : [...left].sort()
    for (const t of batch) {
      order.push(t)
      left.delete(t)
    }
  }
  return order
}

export async function seedEveryTable(
  db: Db,
  storeId: string,
  opts: SeedEveryTableOptions = {},
): Promise<SeededStore> {
  const { tables, columns, fks, checks } = await catalogue(db)
  const literals = allowedLiterals(checks)
  const globals = new Map(Object.entries(opts.globals ?? {}))
  globals.set('store', storeId)
  const rowsPerTable = Math.max(1, opts.rowsPerTable ?? 1)

  const ids = new Map<string, string[]>()
  const seeded: string[] = []
  const failed: { table: string; error: string }[] = []

  /** An existing row id for a foreign key target, creating a non-store parent row if needed. */
  const parentId = async (fk: ForeignKey): Promise<unknown> => {
    if (fk.parentColumn !== 'id') return undefined
    const own = ids.get(fk.parent)
    if (own?.length) return own[0]
    if (tables.includes(fk.parent)) return undefined
    const known = globals.get(fk.parent)
    if (known) return known
    // A platform table (user, organization, invitation, ...): one row of its own, committed
    // straight away on the pool so a failed child row does not take it with it.
    const made = await insertRow(db, fk.parent, false)
    if (made) globals.set(fk.parent, made)
    return made
  }

  const insertRow = async (
    exec: Exec,
    table: string,
    storeScoped: boolean,
  ): Promise<string | undefined> => {
    const cols = columns.filter((c) => c.table === table && !c.generated)
    const names: string[] = []
    const values: unknown[] = []
    for (const col of cols) {
      const fk = fks.find((f) => f.child === table && f.column === col.name)
      let value: unknown
      if (storeScoped && col.name === 'store_id') value = storeId
      else if (fk) value = await parentId(fk)
      else if (literals.has(`${table}.${col.name}`)) value = literals.get(`${table}.${col.name}`)
      else if (col.notNull && !col.hasDefault) value = valueFor(col)
      else if (col.name === 'id' && !col.hasDefault) value = valueFor(col)
      else if (col.name === 'email' || col.name === 'phone') value = valueFor(col)
      if (value === undefined) {
        if (col.notNull && !col.hasDefault) return undefined
        continue
      }
      names.push(col.name)
      values.push(value)
    }
    const colSql = sql.join(
      names.map((n) => sql.identifier(n)),
      sql`, `,
    )
    const valSql = sql.join(
      values.map((v) =>
        typeof v === 'object' && v !== null ? (v as ReturnType<typeof sql>) : sql`${v}`,
      ),
      sql`, `,
    )
    const hasId = cols.some((c) => c.name === 'id')
    const rows = await exec.execute<{ id: string }>(
      hasId
        ? sql`insert into ${sql.identifier(table)} (${colSql}) values (${valSql}) returning id::text as id`
        : sql`insert into ${sql.identifier(table)} (${colSql}) values (${valSql})`,
    )
    return hasId ? rows[0]?.id : ''
  }

  for (const table of seedOrder(tables, fks)) {
    let ok = 0
    for (let i = 0; i < rowsPerTable; i++) {
      try {
        const id = await db.transaction(async (tx) => {
          const made = await insertRow(tx, table, true)
          if (made === undefined) throw new Error('a required foreign key has no parent row')
          return made
        })
        if (id) ids.set(table, [...(ids.get(table) ?? []), id])
        ok += 1
      } catch (err) {
        if (i === 0) failed.push({ table, error: err instanceof Error ? err.message : String(err) })
        break
      }
    }
    if (ok > 0) seeded.push(table)
  }
  return { storeId, ids, seeded, failed }
}
