import {
  address,
  customer,
  inventoryLevel,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError, OutOfStock } from '../errors'

/**
 * Draft orders: an order a merchant builds by hand (phone order, WhatsApp
 * sale, a quote) that has not been placed. It lives in the `order` table with
 * status `draft`, which keeps one order id from creation to fulfilment, and is
 * excluded from every list, stat and revenue figure until it converts. Stock
 * is only reserved at conversion, so a draft never holds inventory hostage.
 */

export class DraftNotEditable extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('DRAFT_NOT_EDITABLE', `Order ${id} is no longer a draft`, { storeId })
  }
}

export class DraftEmpty extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('DRAFT_EMPTY', `Draft ${id} has no lines`, { storeId })
  }
}

export const DraftLineSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(999),
  /** Overrides the variant price for this draft only; blank keeps the catalogue price. */
  unitPricePaise: z.number().int().min(0).optional(),
})

export const DraftAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  stateCode: z.string().trim().min(2).max(3),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  phone: z.string().trim().min(6).max(20),
})

export const DraftInputSchema = z.object({
  customerId: z.uuid().nullish(),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(20).nullish(),
  customerName: z.string().trim().max(120).nullish(),
  shipping: DraftAddressSchema.nullish(),
  lines: z.array(DraftLineSchema).max(100).default([]),
  discountPaise: z.number().int().min(0).default(0),
  discountLabel: z.string().trim().max(120).nullish(),
  shippingPaise: z.number().int().min(0).default(0),
  paymentMethod: z.string().trim().max(60).nullish(),
  note: z.string().trim().max(2000).nullish(),
})

export type DraftInput = z.infer<typeof DraftInputSchema>

export type DraftListItem = {
  id: string
  number: number
  customerName: string | null
  email: string | null
  lineCount: number
  totalPaise: number
  createdAt: Date
  invoiceSentAt: Date | null
}

const DRAFT_TAG = 'draft'

/** Line snapshot at the catalogue's current price, or the merchant's override. */
async function resolveLines(ctx: StoreContext, lines: DraftInput['lines']) {
  if (lines.length === 0) return []
  const ids = [...new Set(lines.map((l) => l.variantId))]
  const rows = await ctx.tx
    .select({
      id: variant.id,
      title: variant.title,
      pricePaise: variant.pricePaise,
      productTitle: product.title,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  return lines.map((l) => {
    const v = byId.get(l.variantId)
    if (!v) {
      throw new CommerceError('VARIANT_NOT_FOUND', `Variant ${l.variantId} is not in this store`)
    }
    return {
      variantId: l.variantId,
      title: v.productTitle,
      variantTitle: v.title,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise ?? v.pricePaise,
    }
  })
}

const sumPaise = (lines: { quantity: number; unitPricePaise: number }[]) =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/** Draft numbers come from the same counter as orders, so a converted draft keeps its number. */
async function nextNumber(ctx: StoreContext): Promise<number> {
  const [s] = await ctx.tx
    .update(store)
    .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
    .where(eq(store.id, ctx.storeId))
    .returning({ next: store.nextOrderNumber })
  if (!s) throw new CommerceError('STORE_NOT_VISIBLE', `store ${ctx.storeId} not visible`)
  return s.next - 1
}

async function writeAddress(ctx: StoreContext, input: DraftInput): Promise<string | null> {
  if (!input.shipping) return null
  const [a] = await ctx.tx
    .insert(address)
    .values({
      storeId: ctx.storeId,
      name: input.shipping.name,
      line1: input.shipping.line1,
      line2: input.shipping.line2 ?? null,
      city: input.shipping.city,
      stateCode: input.shipping.stateCode,
      pincode: input.shipping.pincode,
      phone: input.shipping.phone,
    })
    .returning({ id: address.id })
  return a?.id ?? null
}

async function writeLines(ctx: StoreContext, orderId: string, input: DraftInput) {
  const lines = await resolveLines(ctx, input.lines)
  await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
  if (lines.length > 0) {
    await ctx.tx
      .insert(orderLine)
      .values(lines.map((l) => ({ storeId: ctx.storeId, orderId, ...l })))
  }
  return lines
}

function totals(lines: { quantity: number; unitPricePaise: number }[], input: DraftInput) {
  const subtotalPaise = sumPaise(lines)
  const discountPaise = Math.min(input.discountPaise, subtotalPaise)
  return {
    subtotalPaise,
    discountPaise,
    totalPaise: subtotalPaise - discountPaise + input.shippingPaise,
  }
}

export async function createDraft(ctx: StoreContext, input: DraftInput) {
  const number = await nextNumber(ctx)
  const shippingAddressId = await writeAddress(ctx, input)
  const [o] = await ctx.tx
    .insert(order)
    .values({
      storeId: ctx.storeId,
      number,
      status: 'draft',
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      shippingAddressId,
      paymentMethod: input.paymentMethod ?? null,
      subtotalPaise: 0,
      shippingPaise: input.shippingPaise,
      discountLabel: input.discountLabel ?? null,
      discountPaise: 0,
      totalPaise: 0,
      tags: [DRAFT_TAG],
    })
    .returning({ id: order.id })
  if (!o) throw new CommerceError('DRAFT_INSERT_FAILED', 'draft insert returned nothing')
  const lines = await writeLines(ctx, o.id, input)
  const t = totals(lines, input)
  await ctx.tx.update(order).set(t).where(eq(order.id, o.id))
  if (input.note) await setDraftNote(ctx, o.id, input.note)
  return { id: o.id, number }
}

export async function updateDraft(ctx: StoreContext, id: string, input: DraftInput) {
  const [existing] = await ctx.tx.select().from(order).where(eq(order.id, id))
  if (!existing) return null
  if (existing.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  const shippingAddressId = input.shipping
    ? await writeAddress(ctx, input)
    : existing.shippingAddressId
  const lines = await writeLines(ctx, id, input)
  const t = totals(lines, input)
  const [o] = await ctx.tx
    .update(order)
    .set({
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      shippingAddressId,
      paymentMethod: input.paymentMethod ?? null,
      discountLabel: input.discountLabel ?? null,
      shippingPaise: input.shippingPaise,
      ...t,
    })
    .where(eq(order.id, id))
    .returning({ id: order.id })
  if (input.note !== undefined) await setDraftNote(ctx, id, input.note ?? '')
  return o ?? null
}

/** The note lives in order_note so the timeline shows it once the draft converts. */
async function setDraftNote(ctx: StoreContext, orderId: string, body: string) {
  await ctx.tx
    .delete(orderNote)
    .where(and(eq(orderNote.orderId, orderId), eq(orderNote.author, DRAFT_TAG)))
  if (body.trim()) {
    await ctx.tx
      .insert(orderNote)
      .values({ storeId: ctx.storeId, orderId, body: body.trim(), author: DRAFT_TAG })
  }
}

export async function listDrafts(
  ctx: StoreContext,
  input: { page: number; perPage: number; search?: string | undefined },
): Promise<{ items: DraftListItem[]; total: number }> {
  const search = input.search?.trim()
  const where = and(
    eq(order.status, 'draft'),
    search
      ? sql`(${order.email} ilike ${`%${search}%`} or ${customer.name} ilike ${`%${search}%`} or cast(${order.number} as text) like ${`%${search}%`})`
      : undefined,
  )
  const [countRow] = await ctx.tx
    .select({ total: sql<number>`count(*)::int` })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const items = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      customerName: customer.name,
      email: order.email,
      totalPaise: order.totalPaise,
      createdAt: order.placedAt,
      lineCount: sql<number>`(select coalesce(sum(ol.quantity), 0)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      invoiceSentAt: sql<Date | null>`(
        select max(n.created_at) from notification n
        where n.order_id = ${order.id} and n.template = 'draft_invoice' and n.status = 'sent')`,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

export async function deleteDraft(ctx: StoreContext, id: string) {
  const [o] = await ctx.tx.select({ status: order.status }).from(order).where(eq(order.id, id))
  if (!o) return false
  if (o.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  await ctx.tx.delete(notification).where(eq(notification.orderId, id))
  await ctx.tx.delete(orderNote).where(eq(orderNote.orderId, id))
  await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, id))
  await ctx.tx.delete(order).where(eq(order.id, id))
  return true
}

/**
 * Turn the draft into a real order: hold the stock, record a pending payment
 * for the chosen method and flip the status. The stock guard is the same
 * conditional update placeOrder uses, so two conversions cannot oversell.
 */
export async function convertDraft(
  ctx: StoreContext,
  id: string,
  opts: { paymentMethod?: string | undefined } = {},
) {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, id))
  if (!o) return null
  if (o.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, id))
  if (lines.length === 0) throw new DraftEmpty(id, ctx.storeId)

  for (const line of lines) {
    const held = await ctx.tx
      .update(inventoryLevel)
      .set({ reserved: sql`${inventoryLevel.reserved} + ${line.quantity}` })
      .where(
        and(
          eq(inventoryLevel.variantId, line.variantId),
          sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved} >= ${line.quantity}`,
        ),
      )
      .returning({ variantId: inventoryLevel.variantId })
    /* An untracked variant has no inventory row; only a tracked, short one comes back empty. */
    if (held.length === 0) {
      const [level] = await ctx.tx
        .select({ variantId: inventoryLevel.variantId })
        .from(inventoryLevel)
        .where(eq(inventoryLevel.variantId, line.variantId))
      if (level) throw new OutOfStock(line.variantId, ctx.storeId)
    }
  }

  const method = opts.paymentMethod ?? o.paymentMethod ?? 'manual'
  const [updated] = await ctx.tx
    .update(order)
    .set({ status: 'placed', paymentMethod: method, placedAt: new Date() })
    .where(eq(order.id, id))
    .returning()
  await ctx.tx.insert(payment).values({
    storeId: ctx.storeId,
    orderId: id,
    provider: method,
    providerRef: `draft_${id}`,
    status: 'pending',
    amountPaise: o.totalPaise,
  })
  return updated ?? null
}
