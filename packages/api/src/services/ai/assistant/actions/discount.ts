/**
 * "Create discount DIWALI10: 10% off collection Mice, 20 Oct to 5 Nov". Creates a code
 * discount through the same service as Discounts → Create. Undo switches it off (discounts
 * are never deleted by the assistant).
 */
import { type DiscountInput, DiscountInputSchema, permissions } from '@commerce/core'
import { collectionProduct, discount } from '@commerce/db'
import { toMinor } from '@commerce/money'
import { count, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { createDiscount, DiscountCodeTaken, setDiscountStatus } from '../../../discount.service'
import {
  dayOf,
  findCollections,
  findProductsByName,
  listed,
  ProposalProblem,
  rupees,
  shortDay,
} from './resolve'
import { type ActionEnv, defineAction } from './types'

const DAY_MS = 86_400_000

const Input = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .describe('The code customers type at checkout: letters, numbers and hyphens, e.g. DIWALI10.'),
  title: z.string().trim().max(120).optional().describe('Internal name; defaults to the code.'),
  type: z
    .enum(['percent', 'amount', 'freeShipping'])
    .default('percent')
    .describe('percent off, a fixed amount off in rupees, or free shipping.'),
  value: z
    .number()
    .min(0)
    .max(1_000_000)
    .optional()
    .describe(
      'Percent off (1-90) for percent; rupees off for amount; leave out for free shipping.',
    ),
  appliesTo: z.enum(['all', 'collections', 'products']).default('all'),
  collections: z
    .array(z.string().max(200))
    .max(20)
    .default([])
    .describe('Collection titles or handles.'),
  products: z.array(z.string().max(200)).max(50).default([]).describe('Product titles or handles.'),
  minimumOrderRupees: z.number().min(0).max(10_000_000).optional(),
  usageLimit: z.number().int().min(1).max(1_000_000).optional().describe('Total uses allowed.'),
  startsOn: z
    .string()
    .optional()
    .describe('First day, YYYY-MM-DD (India time). Leave out to start now.'),
  endsOn: z.string().optional().describe('Last day, inclusive, YYYY-MM-DD (India time).'),
})
type Raw = z.infer<typeof Input>

type Resolved = { discount: DiscountInput; targets: string[] }

/** "Other product discounts, free shipping" or "No other discounts". */
function combinesText(c: { products: boolean; order: boolean; shipping: boolean }): string {
  const parts = [
    c.products ? 'other product discounts' : null,
    c.order ? 'order discounts' : null,
    c.shipping ? 'free shipping' : null,
  ].filter(Boolean)
  if (!parts.length) return 'No other discounts'
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function amountLabel(env: ActionEnv, raw: Raw): string {
  if (raw.type === 'freeShipping') return 'Free shipping'
  if (raw.type === 'amount') return `${rupees(env, toMinor(raw.value ?? 0))} off`
  return `${raw.value ?? 0}% off`
}

async function targetsOf(
  env: ActionEnv,
  raw: Raw,
): Promise<{ ids: string[]; names: string[]; products: number }> {
  if (raw.appliesTo === 'collections') {
    const { found, missing } = await findCollections(env.tx, raw.collections)
    if (missing.length) {
      throw new ProposalProblem(
        `No collection called ${listed(missing.map((m) => `"${m}"`))}. Use listCollections to see them.`,
      )
    }
    if (!found.length) throw new ProposalProblem('Name at least one collection.')
    const [row] = await env.tx
      .select({ n: count() })
      .from(collectionProduct)
      .where(
        inArray(
          collectionProduct.collectionId,
          found.map((c) => c.id),
        ),
      )
    return { ids: found.map((c) => c.id), names: found.map((c) => c.title), products: row?.n ?? 0 }
  }
  if (raw.appliesTo === 'products') {
    const { found, missing } = await findProductsByName(env.tx, raw.products)
    if (missing.length)
      throw new ProposalProblem(`No product called ${listed(missing.map((m) => `"${m}"`))}.`)
    if (!found.length) throw new ProposalProblem('Name at least one product.')
    return { ids: found.map((p) => p.id), names: found.map((p) => p.title), products: found.length }
  }
  return { ids: [], names: [], products: 0 }
}

export const discountAction = defineAction<Raw, Resolved>({
  tool: 'proposeDiscount',
  permission: permissions.DISCOUNTS_WRITE,
  description:
    'Draft a new discount code (percent off, amount off or free shipping) for the whole store, some collections or some products, optionally between two dates. The merchant approves it before it exists.',
  input: Input,
  editFields: (raw) => [
    { key: 'code', kind: 'text', value: raw.code },
    { key: 'value', kind: 'number', value: raw.value ?? null },
    { key: 'startsOn', kind: 'date', value: raw.startsOn ?? null },
    { key: 'endsOn', kind: 'date', value: raw.endsOn ?? null },
  ],
  propose: async (env, raw) => {
    const code = raw.code.toUpperCase().replace(/\s+/g, '')
    const [clash] = await env.tx
      .select({ id: discount.id })
      .from(discount)
      .where(eq(discount.code, code))
    if (clash)
      throw new ProposalProblem(
        `The code ${code} is already used by another discount. Pick another code.`,
      )
    if (raw.type === 'percent' && (!raw.value || raw.value < 1 || raw.value > 90)) {
      throw new ProposalProblem('A percent discount must be between 1% and 90%.')
    }
    if (raw.type === 'amount' && (!raw.value || raw.value < 1)) {
      throw new ProposalProblem('Say how many rupees off.')
    }
    const startsAt = dayOf(env, raw.startsOn)
    const endDay = dayOf(env, raw.endsOn)
    const endsAt = endDay ? new Date(endDay.getTime() + DAY_MS - 60_000) : null
    if (endsAt && endsAt.getTime() < env.now.getTime())
      throw new ProposalProblem('The end date is in the past.')
    const targets = await targetsOf(env, raw)
    const parsed = DiscountInputSchema.safeParse({
      title: raw.title || code,
      kind: 'code',
      code,
      method:
        raw.type === 'freeShipping' ? 'free_shipping' : raw.type === 'amount' ? 'fixed' : 'percent',
      value:
        raw.type === 'percent'
          ? Math.round((raw.value ?? 0) * 100)
          : raw.type === 'amount'
            ? toMinor(raw.value ?? 0)
            : 0,
      minSubtotalPaise: raw.minimumOrderRupees ? toMinor(raw.minimumOrderRupees) : null,
      appliesTo: raw.appliesTo,
      appliesToIds: targets.ids,
      usageLimit: raw.usageLimit ?? null,
      startsAt,
      endsAt,
      status: 'active',
    })
    if (!parsed.success) {
      throw new ProposalProblem(parsed.error.issues.map((i) => i.message).join('. '))
    }
    const scope =
      raw.appliesTo === 'all'
        ? 'everything'
        : `${raw.appliesTo === 'collections' ? 'collection' : 'product'} ${listed(targets.names)}`
    const when =
      startsAt || endsAt
        ? `${startsAt ? shortDay(env, startsAt) : 'now'} to ${endsAt ? shortDay(env, endsAt) : 'no end date'}`
        : 'starts now, no end date'
    const amount = amountLabel(env, raw)
    return {
      summary: `Create discount ${code}: ${amount.toLowerCase()} ${scope}, ${when}`,
      resolved: { discount: parsed.data, targets: targets.names },
      preview: {
        title: `Create discount ${code}`,
        lines: [
          { label: 'Amount', value: amount },
          {
            label: 'Applies to',
            value:
              raw.appliesTo === 'all'
                ? 'All products'
                : `${listed(targets.names)} (${targets.products} products)`,
          },
          { label: 'Active', value: when.charAt(0).toUpperCase() + when.slice(1) },
          // Every setting, defaults too, so the merchant approves what will exist (audit #193).
          { label: 'Customers', value: 'All customers' },
          {
            label: 'Minimum order',
            value: raw.minimumOrderRupees ? rupees(env, toMinor(raw.minimumOrderRupees)) : 'None',
          },
          { label: 'Uses', value: raw.usageLimit ? `${raw.usageLimit} in total` : 'No limit' },
          { label: 'Combines with', value: combinesText(parsed.data.combinesWith) },
          ...(endsAt ? [{ label: 'Ends at', value: '11:59 pm on the last day (India time)' }] : []),
        ],
        rows: [],
        more: 0,
        count: targets.products,
        undoable: true,
        notes: [],
      },
    }
  },
  execute: async (env, resolved) => {
    try {
      // Stored as JSON: dates come back as strings, so parse again (the schema coerces them).
      const input = DiscountInputSchema.parse(resolved.discount)
      const created = await createDiscount(env.tx, env.storeId, input)
      if (!created) throw new ProposalProblem('The discount could not be created.')
      return {
        message: `Discount ${created.code ?? created.title} created`,
        href: `/discounts/${created.id}`,
        result: { discountId: created.id, code: created.code },
        undo: { discountId: created.id },
      }
    } catch (err) {
      if (err instanceof DiscountCodeTaken) throw new ProposalProblem(err.message)
      throw err
    }
  },
  undo: async (env, undo) => {
    const { discountId } = undo as { discountId: string }
    const row = await setDiscountStatus(env.tx, discountId, 'disabled')
    if (!row) throw new ProposalProblem('That discount no longer exists.')
    return `Discount ${row.code ?? row.title} switched off`
  },
})
