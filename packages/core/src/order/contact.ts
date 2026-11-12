/** SOURCE OF TRUTH: order contact edits — WHAT: changing an order's email, phone, shipping address and billing (address, company, GSTIN) from admin / WHY: one place that snapshots the new address, syncs the customer's book on request and logs the change */
import { address, customer, customerAddress, order, orderNote } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { createAddress, listAddresses, updateAddress } from '../accounts/addresses'
import { AddressInputSchema, fieldErrors, normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GSTIN_MESSAGES, validateGstin } from '../tax/gstin'

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
  /**
   * Who the bill goes to. Left out keeps the order's billing as it is. `address` null bills the
   * shipping address; the company and GSTIN print on the GST invoice either way. The billing
   * phone is the contact phone.
   */
  billing?:
    | {
        address: {
          name: string
          line1: string
          line2?: string | null | undefined
          city: string
          stateCode: string
          pincode: string
        } | null
        businessName: string | null
        gstin: string | null
      }
    | undefined
  /** Staff email, shown beside the timeline entry. */
  author: string
  /**
   * An imported order: its contact and addresses can be corrected, but the GSTIN and company
   * name are the tax record the other platform invoiced; a change to either is refused.
   */
  lockTax?: boolean | undefined
}

/** Said when an imported order's GSTIN or company name would change. */
const IMPORTED_TAX_LOCKED = 'An imported order keeps the GSTIN and company name it came with.'

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
  '^(Email changed from|Phone changed from|Name changed from|Name set to|Shipping address changed from|Shipping address set to|Billing address changed from|Billing address set to|Billing address is now the shipping address|GSTIN changed from|Company name changed from)'

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

  const billing = input.billing
    ? await nextBilling(ctx, o, input.billing, input.phone ?? '', changes, input.lockTax === true)
    : null

  await ctx.tx
    .update(order)
    .set({ email, phone, shippingAddressId, ...(billing ?? {}) })
    .where(eq(order.id, input.orderId))
  if (before && shippingAddressId !== before.id) await dropSnapshot(ctx, before.id)
  if (billing && o.billingAddressId && billing.billingAddressId !== o.billingAddressId) {
    await dropSnapshot(ctx, o.billingAddressId)
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

/**
 * Drop an address snapshot no order points at any more (orders are its only reference, and
 * invoices copy the address when they are issued); left behind it would outlive an erasure.
 */
async function dropSnapshot(ctx: StoreContext, id: string) {
  await ctx.tx
    .delete(address)
    .where(
      and(
        eq(address.id, id),
        sql`not exists (select 1 from ${order} where ${order.shippingAddressId} = ${id} or ${order.billingAddressId} = ${id})`,
      ),
    )
}

/**
 * The order's billing columns after the edit, with what changed added to `changes`. A new
 * billing address is a new snapshot; an unchanged one keeps its row. Field errors come back
 * as `billing.<field>` (and `gstin`) so the dialog can tell them from the shipping ones.
 */
async function nextBilling(
  ctx: StoreContext,
  o: typeof order.$inferSelect,
  input: NonNullable<OrderContactInput['billing']>,
  phone: string,
  changes: string[],
  lockTax: boolean,
) {
  // An imported order's tax record is compared as typed, before any check of the GSTIN itself.
  if (
    lockTax &&
    (!same(o.buyerGstin, input.gstin?.trim().toUpperCase()) ||
      !same(o.buyerBusinessName, input.businessName))
  ) {
    throw new InvalidOrderContact({ gstin: IMPORTED_TAX_LOCKED }, ctx.storeId)
  }
  let gstin: string | null = null
  if (input.gstin?.trim()) {
    const check = validateGstin(input.gstin)
    if (!check.ok) {
      const message =
        GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape
      throw new InvalidOrderContact({ gstin: message }, ctx.storeId)
    }
    gstin = check.gstin
  }
  const businessName = input.businessName?.trim() || null
  if (!same(o.buyerGstin, gstin)) {
    changes.push(`GSTIN changed from ${o.buyerGstin || 'none'} to ${gstin || 'none'}`)
  }
  if (!same(o.buyerBusinessName, businessName)) {
    changes.push(
      `Company name changed from ${o.buyerBusinessName || 'none'} to ${businessName || 'none'}`,
    )
  }

  const [before] = o.billingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.billingAddressId))
    : []
  let billingAddressId: string | null = null
  if (input.address) {
    const parsed = AddressInputSchema.safeParse({
      ...input.address,
      line2: input.address.line2 ?? undefined,
      phone,
    })
    if (!parsed.success) {
      const errors = Object.fromEntries(
        Object.entries(fieldErrors(parsed.error)).map(([k, v]) => [`billing.${k}`, v]),
      )
      throw new InvalidOrderContact(errors, ctx.storeId)
    }
    const a = parsed.data
    const toLine = oneLine({ ...a, line2: a.line2 ?? null })
    const unchanged =
      before &&
      same(before.name, a.name) &&
      same(before.phone, a.phone) &&
      oneLine(before) === toLine
    if (unchanged) {
      billingAddressId = before.id
    } else {
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
      billingAddressId = row?.id ?? null
      changes.push(
        before
          ? `Billing address changed from ${before.name}, ${oneLine(before)} to ${a.name}, ${toLine}`
          : `Billing address set to ${a.name}, ${toLine}`,
      )
    }
  } else if (before) {
    changes.push('Billing address is now the shipping address')
  }
  return { billingAddressId, buyerGstin: gstin, buyerBusinessName: businessName }
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
