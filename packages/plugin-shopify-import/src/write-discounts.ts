/**
 * Shopify discounts → ours. Our model is one code (or one automatic offer) with
 * a percent, an amount or free shipping, on everything, some products or some
 * collections, with an optional minimum, dates and usage caps. Anything else
 * (buy X get Y, app discounts, customer lists, quantity minimums, single
 * variants, per-item amounts, shipping country or price rules) stays in
 * Shopify with the reason. A discount with several codes becomes one discount
 * per code here. Matched on the import mapping, then the code.
 */
import { DiscountInputSchema, normaliseCode } from '@commerce/core'
import { collection, discount, product } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import { fetchDiscounts, MAX_CODES } from './api-discounts'
import type { LeftBehindReason } from './client'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { ShopifyClient } from './shopify-client'
import type { NDiscount } from './types'

const R = 'discounts'
const CODE = /^[A-Za-z0-9-]{2,40}$/

type Refusal = { reason: LeftBehindReason; message: string }

/** Why a discount cannot be expressed here, before looking anything up. */
export function refusal(d: NDiscount): Refusal | null {
  if (d.typename.includes('Bxgy')) {
    return { reason: 'buy_x_get_y', message: 'Buy X get Y discounts are not supported yet' }
  }
  if (d.typename.includes('App')) {
    return { reason: 'app_discount', message: 'Made by a Shopify app; its rules live in that app' }
  }
  if (!d.method) {
    return { reason: 'buy_x_get_y', message: 'This kind of discount value is not supported yet' }
  }
  if (!d.allCustomers) {
    return {
      reason: 'customer_specific',
      message: 'Only for chosen customers or segments; ours apply to every customer',
    }
  }
  if (d.minQuantity) {
    return {
      reason: 'minimum_quantity',
      message: `Needs at least ${d.minQuantity} items; ours can only ask for a minimum amount`,
    }
  }
  if (d.items.kind === 'products' && d.items.variants) {
    return {
      reason: 'variant_specific',
      message: 'Applies to single variants; ours apply to whole products',
    }
  }
  if (d.appliesOnEachItem) {
    return {
      reason: 'per_item_amount',
      message: 'Takes the amount off each item; ours take it off the order once',
    }
  }
  if (d.method === 'free_shipping') {
    const countries = d.countries === 'all' ? [] : d.countries
    if (
      d.maxShippingPaise !== null ||
      (d.countries !== 'all' && !countries.every((c) => c === 'IN'))
    ) {
      return {
        reason: 'shipping_rules',
        message: 'Limits free shipping by country or shipping price; ours cover all shipping',
      }
    }
  }
  if (d.items.kind !== 'all' && d.items.more) {
    return {
      reason: 'items_not_imported',
      message: 'Applies to more than 100 products or collections; pick them again here',
    }
  }
  return null
}

/** Our product or collection ids for the Shopify ones, keeping only what was imported. */
async function scopeIds(ctx: ImportContext, d: NDiscount): Promise<string[]> {
  if (d.items.kind === 'all') return []
  const resource = d.items.kind
  const table = resource === 'products' ? product : collection
  const ids = d.items.ids
  return ctx.inStore(async (tx) => {
    const mapped: string[] = []
    for (const gid of ids) {
      const id = await findMapping(tx, resource, gid)
      if (id) mapped.push(id)
    }
    if (mapped.length === 0) return []
    const rows = await tx.select({ id: table.id }).from(table).where(inArray(table.id, mapped))
    const live = new Set(rows.map((r) => r.id))
    return mapped.filter((id) => live.has(id))
  })
}

async function writeOne(
  ctx: ImportContext,
  d: NDiscount,
  code: { code: string; used: number } | null,
  appliesToIds: string[],
) {
  const ref = code?.code ?? d.title
  const sourceId = code ? `${d.sourceId}#${normaliseCode(code.code)}` : d.sourceId
  const parsed = DiscountInputSchema.safeParse({
    title: d.title.trim().slice(0, 120) || ref,
    kind: d.kind,
    code: code?.code ?? null,
    method: d.method,
    value: d.method === 'free_shipping' ? 0 : d.value,
    minSubtotalPaise: d.minSubtotalPaise,
    appliesTo: d.items.kind,
    appliesToIds,
    usageLimit: d.usageLimit,
    usagePerCustomer: d.oncePerCustomer ? 1 : null,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    status: 'active',
  })
  if (!parsed.success) {
    ctx.report.count(R, 'failed')
    ctx.report.issue({
      resource: R,
      ref,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    })
    return
  }
  const input = parsed.data
  try {
    const existing = await ctx.inStore(async (tx) => {
      const mapped = await findMapping(tx, R, sourceId)
      const where = mapped
        ? eq(discount.id, mapped)
        : input.code
          ? eq(discount.code, normaliseCode(input.code))
          : null
      if (!where) return null
      const [row] = await tx
        .select({ id: discount.id, usedCount: discount.usedCount })
        .from(discount)
        .where(where)
      return row ?? null
    })
    if (ctx.dryRun) {
      ctx.report.count(R, existing ? 'updated' : 'created')
      ctx.report.sample({
        resource: R,
        key: sourceId,
        title: ref,
        action: existing ? 'update' : 'create',
        detail: d.kind === 'code' ? 'Discount code' : 'Automatic discount',
      })
      return
    }
    const used = Math.max(code?.used ?? d.used, existing?.usedCount ?? 0)
    const row = {
      title: input.title,
      kind: input.kind,
      code: input.kind === 'code' && input.code ? normaliseCode(input.code) : null,
      method: input.method,
      value: input.method === 'free_shipping' ? 0 : input.value,
      minSubtotalPaise: input.minSubtotalPaise ?? null,
      appliesTo: input.appliesTo,
      appliesToIds: input.appliesTo === 'all' ? [] : input.appliesToIds,
      usageLimit: input.usageLimit ?? null,
      usagePerCustomer: input.usagePerCustomer ?? null,
      usedCount: used,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status,
      updatedAt: new Date(),
    }
    await ctx.inStore(async (tx) => {
      let id = existing?.id
      if (id) await tx.update(discount).set(row).where(eq(discount.id, id))
      else {
        const [created] = await tx
          .insert(discount)
          .values({ ...row, storeId: ctx.storeId })
          .returning({ id: discount.id })
        id = created?.id
      }
      if (id) await saveMapping(tx, ctx.storeId, R, sourceId, id)
    })
    ctx.report.count(R, existing ? 'updated' : 'created')
  } catch (err) {
    ctx.report.count(R, 'failed')
    ctx.report.issue({ resource: R, ref, sourceId: d.sourceId, message: errorMessage(err) })
  }
}

async function writeDiscount(
  ctx: ImportContext,
  d: NDiscount & { truncatedCodes?: boolean },
): Promise<void> {
  const codes = d.kind === 'code' ? d.codes : [null]
  const units = Math.max(1, codes.length)
  ctx.report.addTotal(R, units)
  const ref = d.kind === 'code' ? (d.codes[0]?.code ?? d.title) : d.title
  const refused = refusal(d)
  if (refused) {
    for (let i = 0; i < units; i++) ctx.report.count(R, 'skipped')
    ctx.report.leave(R, refused.reason, units)
    ctx.report.issue({ resource: R, ref, message: refused.message })
    return
  }
  if (d.truncatedCodes) {
    ctx.report.issue({
      resource: R,
      ref,
      message: `Has more than ${MAX_CODES.toLocaleString('en-IN')} codes; only the first ${MAX_CODES.toLocaleString('en-IN')} were imported`,
    })
  }
  const appliesToIds = await scopeIds(ctx, d)
  if (d.items.kind !== 'all') {
    // A dry run has not imported the products yet; it only checks the rest.
    const wanted = d.items.ids.length
    if (!ctx.dryRun && appliesToIds.length === 0) {
      for (let i = 0; i < units; i++) ctx.report.count(R, 'skipped')
      ctx.report.leave(R, 'items_not_imported', units)
      ctx.report.issue({
        resource: R,
        ref,
        message: `None of its ${d.items.kind} were imported; import ${d.items.kind} first, then run this again`,
      })
      return
    }
    if (!ctx.dryRun && appliesToIds.length < wanted) {
      ctx.report.issue({
        resource: R,
        ref,
        message: `${wanted - appliesToIds.length} of its ${wanted} ${d.items.kind} were not imported; it applies to the rest`,
      })
    }
    if (d.minSubtotalPaise) {
      ctx.report.issue({
        resource: R,
        ref,
        message: 'Its minimum amount now counts the whole cart, not only the items it applies to',
      })
    }
  }
  const placeholder = ctx.dryRun && d.items.kind !== 'all' && appliesToIds.length === 0
  const ids = placeholder ? ['00000000-0000-4000-8000-000000000000'] : appliesToIds
  for (const code of codes) {
    if (code && !CODE.test(code.code)) {
      ctx.report.count(R, 'skipped')
      ctx.report.leave(R, 'code_characters')
      ctx.report.issue({
        resource: R,
        ref: code.code,
        message:
          'Codes here use letters, numbers and hyphens only (2 to 40); make a new code for it',
      })
      continue
    }
    await writeOne(ctx, d, code, ids)
  }
}

export async function importDiscounts(
  ctx: ImportContext,
  client: ShopifyClient,
  /** On a retry or "Import remaining", only the discounts this says yes to. */
  only: ((sourceId: string) => boolean) | null = null,
): Promise<void> {
  ctx.report.begin(R)
  for await (const batch of fetchDiscounts(client)) {
    for (const d of batch) {
      if (only && !only(d.sourceId)) continue
      await writeDiscount(ctx, d)
      await ctx.report.flush()
    }
  }
}
