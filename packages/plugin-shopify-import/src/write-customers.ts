import { encryptCustomerPhone, phoneBlindIndex } from '@commerce/core'
import { customer, newId, type StoreTx } from '@commerce/db'
import { eq, inArray, or, type SQL, sql } from 'drizzle-orm'
import { customerAddress } from './address'
import {
  errorMessage,
  findMapping,
  findMappings,
  type ImportContext,
  type MappingRow,
  saveMapping,
  saveMappings,
  writeBatch,
} from './runtime'
import type { NCustomer } from './types'

export const customerSourceId = (c: Pick<NCustomer, 'sourceId' | 'email' | 'phone'>) =>
  c.sourceId ?? (c.email ? `email:${c.email}` : `phone:${c.phone ?? ''}`)

/**
 * Mapping first, then email, then phone: the same shopper is never created twice.
 * `customer.phone` is encrypted, so the phone match is by blind index
 * (`customer.phone_index`), never `eq(customer.phone, ...)` — that would never hit
 * once a row's phone is encrypted (`packages/core/src/customers/phone-crypto.ts`).
 */
export async function matchCustomer(
  tx: StoreTx,
  c: NCustomer,
  secret: string,
): Promise<string | null> {
  const mapped = await findMapping(tx, 'customers', customerSourceId(c))
  if (mapped) {
    const [row] = await tx.select({ id: customer.id }).from(customer).where(eq(customer.id, mapped))
    if (row) return row.id
  }
  if (c.email) {
    const [row] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.email, c.email))
    if (row) return row.id
  }
  if (c.phone) {
    const [row] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.phoneIndex, phoneBlindIndex(c.phone, secret)))
    if (row) return row.id
  }
  return null
}

const mergeTags = (a: string[], b: string[]) => {
  const seen = new Set(a.map((t) => t.toLowerCase()))
  return [...a, ...b.filter((t) => !seen.has(t.toLowerCase()))].slice(0, 100)
}

const nameOf = (c: NCustomer) => [c.firstName, c.lastName].filter(Boolean).join(' ') || null
const refOf = (c: NCustomer) => c.email ?? c.phone ?? nameOf(c)

/**
 * The contact phone to store: Shopify's customer phone, else their default address phone (most
 * Indian shoppers only ever typed one at checkout), so WhatsApp and SMS consent can be asked.
 * Matching still uses the customer phone only, so a shared address number never merges two
 * shoppers.
 */
export const contactPhoneOf = (c: NCustomer): string | null => c.phone || c.address?.phone || null

/**
 * The columns both an update and an insert set. No phone in Shopify leaves the stored one
 * alone, so a re-import never wipes a number staff added.
 */
function fieldsOf(c: NCustomer, secret: string) {
  const phone = contactPhoneOf(c)
  // Stored encrypted, the same as the admin and checkout paths (docs/security/data-protection.md).
  return {
    name: nameOf(c),
    ...(phone
      ? {
          phone: encryptCustomerPhone(phone, secret).cipher,
          phoneIndex: phoneBlindIndex(phone, secret),
        }
      : {}),
    note: c.note,
    acceptsMarketing: c.acceptsMarketing,
    ...(c.address ? { defaultAddress: customerAddress(c.address) } : {}),
    updatedAt: new Date(),
  }
}

async function updateCustomer(
  tx: StoreTx,
  id: string,
  c: NCustomer,
  fields: ReturnType<typeof fieldsOf>,
  current: { tags: string[]; email: string | null } | undefined,
) {
  await tx
    .update(customer)
    .set({
      ...fields,
      // An imported number is not proven; a proof only covers the number it was for.
      ...(fields.phoneIndex
        ? {
            phoneVerifiedAt: sql`case when ${customer.phoneIndex} is not distinct from ${fields.phoneIndex} then ${customer.phoneVerifiedAt} else null end`,
          }
        : {}),
      email: current?.email ?? c.email,
      tags: mergeTags(current?.tags ?? [], c.tags),
    })
    .where(eq(customer.id, id))
}

const insertValues = (ctx: ImportContext, c: NCustomer, fields: ReturnType<typeof fieldsOf>) => ({
  id: newId(),
  storeId: ctx.storeId,
  email: c.email,
  tags: c.tags.slice(0, 100),
  ...fields,
  ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
})

function preview(ctx: ImportContext, c: NCustomer, existingId: string | null) {
  const name = nameOf(c)
  const ref = refOf(c)
  ctx.report.count('customers', existingId ? 'updated' : 'created')
  ctx.report.sample({
    resource: 'customers',
    key: ref ?? '',
    title: name ?? ref ?? '',
    action: existingId ? 'update' : 'create',
    detail: c.acceptsMarketing ? 'Subscribed to email' : undefined,
  })
}

export async function writeCustomer(ctx: ImportContext, c: NCustomer): Promise<string | null> {
  try {
    const existingId = await ctx.inStore((tx) => matchCustomer(tx, c, ctx.secret))
    if (ctx.dryRun) {
      preview(ctx, c, existingId)
      return existingId
    }
    const id = await ctx.inStore(async (tx) => {
      const fields = fieldsOf(c, ctx.secret)
      let saved: string
      if (existingId) {
        const [current] = await tx
          .select({ tags: customer.tags, email: customer.email })
          .from(customer)
          .where(eq(customer.id, existingId))
        await updateCustomer(tx, existingId, c, fields, current)
        saved = existingId
      } else {
        const [row] = await tx
          .insert(customer)
          .values(insertValues(ctx, c, fields))
          .returning({ id: customer.id })
        if (!row) throw new Error('Customer was not saved')
        saved = row.id
      }
      await saveMapping(tx, ctx.storeId, 'customers', customerSourceId(c), saved)
      return saved
    })
    ctx.report.count('customers', existingId ? 'updated' : 'created')
    return id
  } catch (err) {
    ctx.report.count('customers', 'failed')
    ctx.report.issue({
      resource: 'customers',
      row: c.row,
      ref: refOf(c),
      sourceId: customerSourceId(c),
      message: errorMessage(err),
    })
    return null
  }
}

/** `later`: shares a Shopify id, email, phone or matched row with an earlier one in the batch. */
type BatchResult = 'created' | 'updated' | 'later'

type Existing = { id: string; email: string | null; phoneIndex: string | null; tags: string[] }

/** Every row any record of the batch could match, in one query (mapping, email, phone). */
async function candidates(tx: StoreTx, batch: readonly NCustomer[], secret: string) {
  const mapped = await findMappings(tx, 'customers', batch.map(customerSourceId))
  const ids = [...new Set(mapped.values())]
  const emails = [...new Set(batch.flatMap((c) => (c.email ? [c.email] : [])))]
  const phones = [
    ...new Set(batch.flatMap((c) => (c.phone ? [phoneBlindIndex(c.phone, secret)] : []))),
  ]
  const where: SQL[] = []
  if (ids.length) where.push(inArray(customer.id, ids))
  if (emails.length) where.push(inArray(customer.email, emails))
  if (phones.length) where.push(inArray(customer.phoneIndex, phones))
  const rows: Existing[] = where.length
    ? await tx
        .select({
          id: customer.id,
          email: customer.email,
          phoneIndex: customer.phoneIndex,
          tags: customer.tags,
        })
        .from(customer)
        .where(or(...where))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const byEmail = new Map<string, Existing>()
  const byPhone = new Map<string, Existing>()
  for (const r of rows) {
    if (r.email && !byEmail.has(r.email)) byEmail.set(r.email, r)
    if (r.phoneIndex && !byPhone.has(r.phoneIndex)) byPhone.set(r.phoneIndex, r)
  }
  /** The same order as `matchCustomer`: mapping (when the row still exists), email, phone. */
  return (c: NCustomer): Existing | null => {
    const viaMapping = mapped.get(customerSourceId(c))
    const hit = viaMapping ? byId.get(viaMapping) : undefined
    if (hit) return hit
    if (c.email && byEmail.has(c.email)) return byEmail.get(c.email) ?? null
    if (c.phone) return byPhone.get(phoneBlindIndex(c.phone, secret)) ?? null
    return null
  }
}

/**
 * The real write for a whole batch: one lookup query, one multi-row insert for
 * the new shoppers, an update per existing one, and one statement for the
 * mappings. A record that touches the same shopper as an earlier one in the
 * batch comes back `later`, to be written after the commit so it matches the
 * row the batch just wrote, as one-at-a-time writes would.
 */
async function saveBatch(
  tx: StoreTx,
  ctx: ImportContext,
  batch: readonly NCustomer[],
): Promise<BatchResult[]> {
  const match = await candidates(tx, batch, ctx.secret)
  const seen = new Set<string>()
  const inserts: ReturnType<typeof insertValues>[] = []
  const mappings: MappingRow[] = []
  const results: BatchResult[] = []
  for (const c of batch) {
    const existing = match(c)
    const keys = [
      `s:${customerSourceId(c)}`,
      c.email ? `e:${c.email}` : null,
      c.phone ? `p:${phoneBlindIndex(c.phone, ctx.secret)}` : null,
      existing ? `id:${existing.id}` : null,
    ].filter((k): k is string => k !== null)
    if (keys.some((k) => seen.has(k))) {
      results.push('later')
      continue
    }
    for (const k of keys) seen.add(k)
    const fields = fieldsOf(c, ctx.secret)
    if (existing) {
      await updateCustomer(tx, existing.id, c, fields, existing)
      mappings.push({ sourceId: customerSourceId(c), localId: existing.id })
      results.push('updated')
    } else {
      const values = insertValues(ctx, c, fields)
      inserts.push(values)
      mappings.push({ sourceId: customerSourceId(c), localId: values.id })
      results.push('created')
    }
  }
  if (inserts.length) await tx.insert(customer).values(inserts)
  await saveMappings(tx, ctx.storeId, 'customers', mappings)
  return results
}

/**
 * A batch of customers: matched in one transaction on a preview, written in
 * one transaction on an import (see `writeBatch` for the fallback).
 */
export async function writeCustomers(ctx: ImportContext, batch: readonly NCustomer[]) {
  if (ctx.dryRun) {
    await writeBatch(ctx, batch, {
      batch: async (tx, items) => {
        const out: (string | null)[] = []
        for (const c of items) out.push(await matchCustomer(tx, c, ctx.secret))
        return out
      },
      report: (c, existingId) => preview(ctx, c, existingId),
      one: (c) => writeCustomer(ctx, c),
    })
    return
  }
  const later: NCustomer[] = []
  await writeBatch(ctx, batch, {
    batch: (tx, items) => saveBatch(tx, ctx, items),
    report: (c, result) => {
      if (result === 'later') later.push(c)
      else ctx.report.count('customers', result)
    },
    one: (c) => writeCustomer(ctx, c),
  })
  for (const c of later) {
    await writeCustomer(ctx, c)
    await ctx.report.flush()
  }
}
