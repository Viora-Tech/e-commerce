/**
 * Shared bits of the assistant's actions: turning names the model wrote ("Mice", a handle,
 * "#2250") into the store's own rows under RLS, store-formatted money and dates, and the
 * plain-language problem a propose step reports back to the model.
 */
import { ASSISTANT_LIMITS } from '@commerce/ai'
import { CommerceError, notSystemTest } from '@commerce/core'
import { dayStart, formatInZone } from '@commerce/dates'
import { collection, order, product, type StoreTx } from '@commerce/db'
import { type Currency, formatMoney } from '@commerce/money'
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { ActionEnv } from './types'

/** A proposal the model must fix: the message goes back to it (and the merchant sees the answer). */
export class ProposalProblem extends CommerceError {
  constructor(message: string) {
    super('AI_PROPOSAL', message)
  }
}

export const MAX_ITEMS = ASSISTANT_LIMITS.maxItemsPerAction

export function rupees(env: Pick<ActionEnv, 'store'>, paise: number): string {
  return formatMoney(paise, env.store.currency as Currency)
}

/** `YYYY-MM-DD` (store time) as the start of that day, or null for blank. */
export function dayOf(
  env: Pick<ActionEnv, 'store'>,
  value: string | undefined | null,
): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ProposalProblem(`"${value}" is not a date like 2026-10-20.`)
  return dayStart(value, env.store.timezone)
}

export function shortDay(env: Pick<ActionEnv, 'store'>, at: Date): string {
  return formatInZone(at, { day: 'numeric', month: 'short' }, { timeZone: env.store.timezone })
}

const norm = (s: string) => s.trim().toLowerCase()

export type FoundCollection = { id: string; title: string; handle: string; kind: string }

/** Collections by title or handle (case-insensitive), the store's own only. */
export async function findCollections(
  tx: StoreTx,
  names: string[],
): Promise<{
  found: FoundCollection[]
  missing: string[]
}> {
  const wanted = names.map(norm).filter(Boolean)
  if (!wanted.length) return { found: [], missing: [] }
  const rows = await tx
    .select({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      kind: collection.kind,
    })
    .from(collection)
    .where(or(inArray(sql`lower(${collection.title})`, wanted), inArray(collection.handle, wanted)))
  const found = wanted.flatMap((w) => {
    const hit = rows.find((r) => norm(r.title) === w || r.handle === w)
    return hit ? [hit] : []
  })
  const missing = names.filter(
    (n) => !rows.some((r) => norm(r.title) === norm(n) || r.handle === norm(n)),
  )
  return { found: [...new Map(found.map((c) => [c.id, c])).values()], missing }
}

export type FoundProduct = { id: string; title: string; handle: string }

/** Products by handle or exact title (case-insensitive), the store's own only. */
export async function findProductsByName(
  tx: StoreTx,
  names: string[],
): Promise<{
  found: FoundProduct[]
  missing: string[]
}> {
  const wanted = names.map(norm).filter(Boolean).slice(0, MAX_ITEMS)
  if (!wanted.length) return { found: [], missing: [] }
  const rows = await tx
    .select({ id: product.id, title: product.title, handle: product.handle })
    .from(product)
    .where(
      and(
        notSystemTest,
        or(inArray(product.handle, wanted), inArray(sql`lower(${product.title})`, wanted)),
      ),
    )
  const missing = names.filter(
    (n) => !rows.some((r) => r.handle === norm(n) || norm(r.title) === norm(n)),
  )
  return { found: rows, missing }
}

/** One product by handle or title, or a problem the model can fix. */
export async function oneProduct(tx: StoreTx, name: string): Promise<FoundProduct> {
  const { found } = await findProductsByName(tx, [name])
  if (found[0]) return found[0]
  const [like] = await tx
    .select({ id: product.id, title: product.title, handle: product.handle })
    .from(product)
    .where(and(notSystemTest, ilike(product.title, `%${name.trim().replace(/[%_]/g, '')}%`)))
    .limit(1)
  if (like) return like
  throw new ProposalProblem(
    `No product called "${name}" in this store. Use findProducts to look it up.`,
  )
}

/** An order by its number, the store's own only. */
export async function orderByNumber(tx: StoreTx, number: number) {
  const [row] = await tx
    .select({ id: order.id, number: order.number })
    .from(order)
    .where(eq(order.number, number))
  if (!row) throw new ProposalProblem(`No order #${number} in this store.`)
  return row
}

/** The first `n` labels of a list, then "and N more". */
export function listed(items: string[], n = 3): string {
  if (items.length <= n) return items.join(', ')
  return `${items.slice(0, n).join(', ')} and ${items.length - n} more`
}
