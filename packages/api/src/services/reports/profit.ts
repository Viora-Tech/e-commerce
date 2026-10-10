import {
  allocateProfit,
  computeOrderProfit,
  notSystemTest,
  type OrderProfit,
  parseProfitCosts,
  profitFacts,
} from '@commerce/core'
import { order, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { istIsoDate } from '../analytics-buckets'
import {
  byDesc,
  groupBy,
  notDraft,
  placedIn,
  type ReportBuilder,
  type ReportRow,
  type ReportSpan,
  sumOf,
} from './types'

/*
 * Profit (Analytics › Reports, Finance): PROFIT_FORMULA from @commerce/core order/profit.ts
 * over every order placed in the span, cancelled ones included (their courier and fee costs are
 * real; their sales count only what was collected). Drafts never count.
 */

type Profited = { orderId: string; placedAt: Date; profit: OrderProfit; facts: ProfitFactsOf }
type ProfitFactsOf = Awaited<ReturnType<typeof profitFacts>>[number]

async function profitsIn(tx: StoreTx, span: ReportSpan): Promise<Profited[]> {
  const ids = (
    await tx
      .select({ id: order.id })
      .from(order)
      .where(and(notDraft, placedIn(span)))
  ).map((r) => r.id)
  if (ids.length === 0) return []
  // The store's own row (row-level security shows only it), as the inventory reports read it.
  const [s] = await tx.select({ apps: store.apps }).from(store).limit(1)
  const costs = parseProfitCosts(s?.apps)
  return (await profitFacts(tx, ids)).map((facts) => ({
    orderId: facts.orderId,
    placedAt: facts.placedAt,
    facts,
    profit: computeOrderProfit({ ...facts, costs }),
  }))
}

/** The money columns every profit row carries, summed over orders. */
function moneyColumns(group: Profited[]) {
  const netSales = sumOf(group, (p) => p.profit.netSalesPaise)
  const profit = sumOf(group, (p) => p.profit.profitPaise)
  return {
    netSales,
    costOfGoods: sumOf(group, (p) => p.profit.goodsPaise),
    courierCost: sumOf(group, (p) => p.profit.courierPaise),
    gatewayFees: sumOf(group, (p) => p.profit.feesPaise),
    rtoCost: sumOf(group, (p) => p.profit.rtoPaise),
    profit,
    margin: netSales > 0 ? profit / netSales : null,
  }
}

/** One row per month (IST) the span touches, oldest first. */
const profitByMonth: ReportBuilder = async (tx, span) => {
  const profits = await profitsIn(tx, span)
  const months = [...new Set(span.days.map((d) => d.slice(0, 7)))]
  const byMonth = groupBy(profits, (p) => istIsoDate(p.placedAt).slice(0, 7))
  const rows: ReportRow[] = months.map((month) => {
    const group = byMonth.get(month) ?? []
    return { key: month, values: { month, orders: group.length, ...moneyColumns(group) } }
  })
  return { rows, totals: { orders: profits.length, ...moneyColumns(profits) } }
}

/** One row per product: its share of each order's sales and costs (allocateProfit). */
const profitByProduct: ReportBuilder = async (tx, span) => {
  const profits = await profitsIn(tx, span)
  const variantIds = [...new Set(profits.flatMap((p) => p.facts.lines.map((l) => l.variantId)))]
  const products = variantIds.length
    ? await tx
        .select({ variantId: variant.id, productId: product.id, title: product.title })
        .from(variant)
        .innerJoin(product, eq(product.id, variant.productId))
        .where(and(inArray(variant.id, variantIds), notSystemTest))
    : []
  const productOf = new Map(products.map((p) => [p.variantId, p]))
  type Part = {
    productId: string
    title: string
    units: number
    net: number
    goods: number
    profit: number
  }
  const parts: Part[] = []
  for (const p of profits) {
    const lines = p.facts.lines.filter((l) => !l.giftCard)
    const goods = lines.map((l) =>
      l.costAtSalePaise === null
        ? 0
        : Math.max(0, l.quantity - l.restockedQuantity) * l.costAtSalePaise,
    )
    const shares = allocateProfit(
      p.profit,
      lines.map((l, i) => ({ grossPaise: l.grossPaise, goodsPaise: goods[i] ?? 0 })),
    )
    lines.forEach((l, i) => {
      const at = productOf.get(l.variantId)
      const share = shares[i]
      if (!at || !share) return
      parts.push({
        productId: at.productId,
        title: at.title,
        units: Math.max(0, l.quantity - l.restockedQuantity),
        net: share.netSalesPaise,
        goods: share.goodsPaise,
        profit: share.profitPaise,
      })
    })
  }
  const rows: ReportRow[] = [...groupBy(parts, (p) => p.productId)]
    .map(([productId, group]) => {
      const netSales = sumOf(group, (g) => g.net)
      const profit = sumOf(group, (g) => g.profit)
      return {
        key: productId,
        values: {
          product: group[0]?.title ?? '',
          units: sumOf(group, (g) => g.units),
          netSales,
          costOfGoods: sumOf(group, (g) => g.goods),
          profit,
          margin: netSales > 0 ? profit / netSales : null,
        },
      }
    })
    .sort(byDesc('profit'))
  const netSales = sumOf(parts, (g) => g.net)
  const profit = sumOf(parts, (g) => g.profit)
  return {
    rows,
    totals: {
      units: sumOf(parts, (g) => g.units),
      netSales,
      costOfGoods: sumOf(parts, (g) => g.goods),
      profit,
      margin: netSales > 0 ? profit / netSales : null,
    },
  }
}

export const profitBuilders = {
  'profit-by-month': profitByMonth,
  'profit-by-product': profitByProduct,
}
