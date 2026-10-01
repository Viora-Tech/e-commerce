/** SOURCE OF TRUTH: store-scoped tables — which tables hold a store's rows, and the order they can be deleted in */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'

/**
 * Every table with a `store_id` column is a store's data (architecture, section 3, rule
 * 2). The list is read from the database catalogue at run time rather than kept by hand,
 * so a table added next month is exported and deleted with the store without anyone
 * remembering to add it here. The catalogue is readable by the app role; the rows are
 * still filtered by RLS.
 */
export type StoreTables = {
  /** Table names, sorted. */
  tables: string[]
  /** Foreign keys between those tables: `[child, parent]`, the child points at the parent. */
  edges: [string, string][]
}

export async function listStoreTables(tx: StoreTx): Promise<StoreTables> {
  const tableRows = await tx.execute<{ name: string }>(sql`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'store_id' and not a.attisdropped
      )
    order by c.relname
  `)
  const tables = tableRows.map((r) => r.name)
  const edgeRows = await tx.execute<{ child: string; parent: string }>(sql`
    select child.relname as child, parent.relname as parent
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace n on n.oid = child.relnamespace and n.nspname = 'public'
    where con.contype = 'f'
  `)
  const set = new Set(tables)
  const edges = edgeRows
    .filter((e) => set.has(e.child) && set.has(e.parent) && e.child !== e.parent)
    .map((e): [string, string] => [e.child, e.parent])
  return { tables, edges }
}

/**
 * Children before parents, so each `delete` leaves nothing pointing at a removed row.
 * Ties are broken by name, so the order is stable from run to run. A cycle cannot be
 * deleted table by table; it throws with the tables involved so the next migration that
 * adds one also says how to break it.
 */
export function deletionOrder({ tables, edges }: StoreTables): string[] {
  // A table can go once nothing that is still left points at it.
  const pointedAtBy = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]))
  for (const [child, parent] of edges) pointedAtBy.get(parent)?.add(child)

  const order: string[] = []
  const left = new Set(tables)
  while (left.size > 0) {
    const free = [...left]
      .filter((t) => [...(pointedAtBy.get(t) ?? [])].every((c) => !left.has(c)))
      .sort()
    if (free.length === 0) {
      throw new Error(
        `store tables reference each other in a cycle: ${[...left].sort().join(', ')}`,
      )
    }
    for (const t of free) {
      order.push(t)
      left.delete(t)
    }
  }
  return order
}
