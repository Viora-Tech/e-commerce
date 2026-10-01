/** SOURCE OF TRUTH: order contact edits — WHAT: changing an order's email, phone and shipping address from admin / WHY: one place that snapshots the new address, syncs the customer's book on request and logs the change */
import { address, customer, customerAddress, order, orderNote } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { createAddress, listAddresses, updateAddress } from '../accounts/addresses'
import { AddressInputSchema, fieldErrors, normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

export class OrderNotFound extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super('ORDER_NOT_FOUND', `Order ${orderId} not found`, { storeId })
  }
}

export class InvalidOrderContact extends CommerceError {
  readonly errors: Record<string, string>
  constructor(errors: Record<string, string>, storeId?: string) {
    super('INVALID_ORDER_CONTACT', Object.values(errors)[0] ?? 'Check the highlighted fields', {
      storeId,
    })
    this.errors = errors
  }
}

export type OrderContactInput = {
  orderId: string
  name: string
  email: string | null
  phone: string | null
  /** Where the parcel goes; null leaves an order with no address (gift cards) without one. */
  address: {
    line1: string
    line2?: string | null | undefined
    city: string
    stateCode: string
    pincode: string
  } | null
  /** Also write the address to the customer's address book as their default. */
  alsoUpdateCustomer: boolean
  /** Staff email, shown beside the timeline entry. */
  author: string
}

type AddressRow = typeof address.$inferSelect

/** A validated parcel address: who it is for, their mobile, and where. */
type ParcelAddress = Pick<
  AddressRow,
  'name' | 'phone' | 'line1' | 'line2' | 'city' | 'stateCode' | 'pincode'
>

const oneLine = (a: Pick<AddressRow, 'line1' | 'line2' | 'city' | 'stateCode' | 'pincode'>) =>
  [a.line1, a.line2, a.city, `${a.stateCode} ${a.pincode}`].filter(Boolean).join(', ')

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim() === (b ?? '').trim()

/**
 * How the contact-change notes this module writes begin. They quote the old and new
 * email, phone, name and address, so erasing a customer (`anonymiseCustomer`) blanks
 * notes that start this way.
 */
export const CONTACT_NOTE_PATTERN =
  '^(Email changed from|Phone changed from|Name changed from|Name set to|Shipping address changed from|Shipping address set to)'

/**
 * Change who an order is for and where it goes, from the order page. The old
 * address row is kept (orders point at snapshots, never edit them in place);
 * a new one is written and the order moves to it. What changed is logged on
 * the order timeline as a note by the staff member. Must run inside
 * `withStore`: RLS hides every other store's orders and customers, so an id
 * from another store is simply not found.
 */
export async function updateOrderContact(ctx: StoreContext, input: OrderContactInput) {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId)).for('update')
  if (!o || o.status === 'draft') throw new OrderNotFound(input.orderId, ctx.storeId)
  const [before] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []

  const email = input.email?.trim().toLowerCase() || null
  const phone = input.phone?.trim() ? (normaliseMobile(input.phone) ?? input.phone.trim()) : null
  const changes: string[] = []
  if (!same(o.email, email))
    changes.push(`Email changed from ${o.email || 'none'} to ${email || 'none'}`)
  if (!same(o.phone, phone))
    changes.push(`Phone changed from ${o.phone || 'none'} to ${phone || 'none'}`)

  let shippingAddressId = o.shippingAddressId
  let saved: ParcelAddress | null = null
  if (input.address) {
    const parsed = AddressInputSchema.safeParse({
      ...input.address,
      // The shared schema takes a blank second line as absent, not null.
      line2: input.address.line2 ?? undefined,
      name: input.name,
      // The parcel's phone is the contact phone; a courier needs a mobile.
      phone: input.phone ?? '',
    })
    if (!parsed.success) throw new InvalidOrderContact(fieldErrors(parsed.error), ctx.storeId)
    const a = parsed.data
    saved = { ...a, line2: a.line2 ?? null }
    const unchanged =
      before &&
      same(before.name, a.name) &&
      same(before.phone, a.phone) &&
      same(before.line1, a.line1) &&
      same(before.line2, a.line2) &&
      same(before.city, a.city) &&
      same(before.stateCode, a.stateCode) &&
      same(before.pincode, a.pincode)
    if (!unchanged) {
      const [row] = await ctx.tx
        .insert(address)
        .values({
          storeId: ctx.storeId,
          name: a.name,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
          phone: a.phone,
        })
        .returning({ id: address.id })
      shippingAddressId = row?.id ?? shippingAddressId
      if (before && !same(before.name, a.name)) {
        changes.push(`Name changed from ${before.name} to ${a.name}`)
      } else if (!before) {
        changes.push(`Name set to ${a.name}`)
      }
      const fromLine = before ? oneLine(before) : null
      const toLine = oneLine({ ...a, line2: a.line2 ?? null })
      if (fromLine !== toLine) {
        changes.push(
          fromLine
            ? `Shipping address changed from ${fromLine} to ${toLine}`
            : `Shipping address set to ${toLine}`,
        )
      }
    }
  } else if (o.customerId && input.name.trim()) {
    // No parcel address on this order (gift cards): the name lives on the customer.
    const [c] = await ctx.tx
      .select({ name: customer.name })
      .from(customer)
      .where(eq(customer.id, o.customerId))
    if (c && !same(c.name, input.name)) {
      await ctx.tx
        .update(customer)
        .set({ name: input.name.trim(), updatedAt: new Date() })
        .where(eq(customer.id, o.customerId))
      changes.push(`Name changed from ${c.name || 'none'} to ${input.name.trim()}`)
    }
  }

  await ctx.tx
    .update(order)
    .set({ email, phone, shippingAddressId })
    .where(eq(order.id, input.orderId))
  if (before && shippingAddressId !== before.id) {
    // The old snapshot is no one's any more (orders are its only reference, and invoices
    // copy the address when they are issued); left behind it would outlive an erasure.
    await ctx.tx
      .delete(address)
      .where(
        and(
          eq(address.id, before.id),
          sql`not exists (select 1 from ${order} where ${order.shippingAddressId} = ${before.id})`,
        ),
      )
  }

  if (input.alsoUpdateCustomer && saved && o.customerId) {
    await saveToAddressBook(ctx, o.customerId, saved)
    changes.push("Customer's saved address updated too")
  }

  if (changes.length > 0) {
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId: input.orderId,
      body: changes.join('\n'),
      author: input.author,
    })
  }
  const [after] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId))
  return { order: after ?? null, changed: changes.length > 0 }
}

/** Overwrite the customer's default saved address, or add it as the default when they have none. */
async function saveToAddressBook(ctx: StoreContext, customerId: string, a: ParcelAddress) {
  const raw = { ...a, line2: a.line2 ?? undefined, isDefault: true }
  const [current] = await ctx.tx
    .select({ id: customerAddress.id })
    .from(customerAddress)
    .where(and(eq(customerAddress.customerId, customerId), eq(customerAddress.isDefault, true)))
  const book = current ? [current] : await listAddresses(ctx, customerId)
  const target = book[0]
  const result = target
    ? await updateAddress(ctx, customerId, target.id, raw)
    : await createAddress(ctx, customerId, raw)
  if (!result.ok) throw new InvalidOrderContact(result.errors, ctx.storeId)
}
