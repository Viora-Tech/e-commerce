import { encryptCustomerPhone, phoneBlindIndex } from '@commerce/core'
import { customer, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { customerAddress } from './address'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
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

export async function writeCustomer(ctx: ImportContext, c: NCustomer): Promise<string | null> {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || null
  const ref = c.email ?? c.phone ?? name
  try {
    const existingId = await ctx.inStore((tx) => matchCustomer(tx, c, ctx.secret))
    if (ctx.dryRun) {
      ctx.report.count('customers', existingId ? 'updated' : 'created')
      ctx.report.sample({
        resource: 'customers',
        key: ref ?? '',
        title: name ?? ref ?? '',
        action: existingId ? 'update' : 'create',
        detail: c.acceptsMarketing ? 'Subscribed to email' : undefined,
      })
      return existingId
    }
    const id = await ctx.inStore(async (tx) => {
      // Stored encrypted, the same as the admin and checkout paths (docs/security/data-protection.md).
      const fields = {
        name,
        phone: c.phone ? encryptCustomerPhone(c.phone, ctx.secret).cipher : c.phone,
        phoneIndex: c.phone ? phoneBlindIndex(c.phone, ctx.secret) : null,
        note: c.note,
        acceptsMarketing: c.acceptsMarketing,
        ...(c.address ? { defaultAddress: customerAddress(c.address) } : {}),
        updatedAt: new Date(),
      }
      let saved: string
      if (existingId) {
        const [current] = await tx
          .select({ tags: customer.tags, email: customer.email })
          .from(customer)
          .where(eq(customer.id, existingId))
        await tx
          .update(customer)
          .set({
            ...fields,
            email: current?.email ?? c.email,
            tags: mergeTags(current?.tags ?? [], c.tags),
          })
          .where(eq(customer.id, existingId))
        saved = existingId
      } else {
        const [row] = await tx
          .insert(customer)
          .values({
            storeId: ctx.storeId,
            email: c.email,
            tags: c.tags.slice(0, 100),
            ...fields,
            ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
          })
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
    ctx.report.issue({ resource: 'customers', row: c.row, ref, message: errorMessage(err) })
    return null
  }
}
