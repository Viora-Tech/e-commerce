import {
  allocateProfit,
  computeOrderProfit,
  expensesForMonth,
  type MonthExpenses,
  monthlyExpenseVersions,
  notSystemTest,
  type OrderProfit,
  parseProfitCosts,
  profitAverages,
  profitFacts,
  profitVerdict,
} from '@commerce/core'
import { order, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { istIsoDate } from '../analytics-buckets'
import {
  byDesc,
  groupBy,
  notDraft,
  type ProfitInsights,
  placedIn,
  type ReportBuilder,
  type ReportRow,
  type ReportSpan,
  sumOf,
} from './types'

/*
 * Profit (Analytics › Reports, Finance): PROFIT_FORMULA from @commerce/core order/profit.ts
 * over every order placed in the span, cancelled ones included (their courier and fee costs are
 * real; their sales count only what was collected). Drafts never count. Packing and delivery are
 * estimated until known (order/profit-estimates.ts), so every figure is a floor while
 * `estimatedOrders` is above zero. Monthly expenses (finance/monthly-expenses.ts) come off the
 * month's order profit for net profit; the month in progress counts the days so far.
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
    packingCost: sumOf(group, (p) => p.profit.packingPaise),
    courierCost: sumOf(group, (p) => p.profit.courierPaise),
    gatewayFees: sumOf(group, (p) => p.profit.feesPaise),
    rtoCost: sumOf(group, (p) => p.profit.rtoPaise),
    profit,
    margin: netSales > 0 ? profit / netSales : null,
  }
}

/** Units sold in an order: not gift cards, not put back in stock. */
const unitsOf = (p: Profited) =>
  sumOf(
    p.facts.lines.filter((l) => !l.giftCard),
    (l) => Math.max(0, l.quantity - l.restockedQuantity),
  )

/** The months the span touches (IST), each with the expenses its counted days carry. */
async function monthsIn(tx: StoreTx, span: ReportSpan): Promise<MonthExpenses[]> {
  const expenses = await monthlyExpenseVersions(tx)
  const today = istIsoDate(span.now)
  const months = [...new Set(span.days.map((d) => d.slice(0, 7)))]
  return months.map((month) => expensesForMonth(expenses, month, { days: span.days, today }))
}

/** PROFIT_AVERAGES (@commerce/core finance/profit-summary.ts) and net profit for the span. */
function insightsOf(profits: Profited[], months: MonthExpenses[]): ProfitInsights {
  const averages = profitAverages(
    profits.map((p) => ({
      profitPaise: p.profit.profitPaise,
      units: unitsOf(p),
      estimated: p.profit.estimated,
    })),
  )
  const expensesPaise = sumOf(months, (m) => m.countedPaise)
  const netProfitPaise = averages.profitPaise - expensesPaise
  const current = months.find((m) => m.inProgress && m.daysCounted < m.daysInMonth)
  return {
    ...averages,
    expensesPaise,
    netProfitPaise,
    verdict: profitVerdict(netProfitPaise, averages.perOrderPaise),
    soFar: current
      ? {
          month: current.month,
          daysCounted: current.daysCounted,
          daysInMonth: current.daysInMonth,
          fullPaise: current.fullPaise,
          countedPaise: current.countedPaise,
        }
      : null,
  }
}

/** One row per month (IST) the span touches, oldest first, with expenses and net profit. */
const profitByMonth: ReportBuilder = async (tx, span) => {
  const profits = await profitsIn(tx, span)
  const months = await monthsIn(tx, span)
  const byMonth = groupBy(profits, (p) => istIsoDate(p.placedAt).slice(0, 7))
  const rows: ReportRow[] = months.map((m) => {
    const group = byMonth.get(m.month) ?? []
    const money = moneyColumns(group)
    return {
      key: m.month,
      values: {
        month: m.month,
        orders: group.length,
        ...money,
        expenses: m.countedPaise,
        netProfit: money.profit - m.countedPaise,
        estimatedOrders: group.filter((p) => p.profit.estimated).length,
      },
    }
  })
  const money = moneyColumns(profits)
  const expenses = sumOf(months, (m) => m.countedPaise)
  return {
    rows,
    totals: {
      orders: profits.length,
      ...money,
      expenses,
      netProfit: money.profit - expenses,
      estimatedOrders: profits.filter((p) => p.profit.estimated).length,
    },
    profit: insightsOf(profits, months),
  }
}

const perUnit = (profit: number, units: number) => (units > 0 ? Math.round(profit / units) : null)

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
          profitPerUnit: perUnit(
            profit,
            sumOf(group, (g) => g.units),
          ),
          margin: netSales > 0 ? profit / netSales : null,
        },
      }
    })
    .sort(byDesc('profit'))
  const netSales = sumOf(parts, (g) => g.net)
  const profit = sumOf(parts, (g) => g.profit)
  const units = sumOf(parts, (g) => g.units)
  return {
    rows,
    totals: {
      units,
      netSales,
      costOfGoods: sumOf(parts, (g) => g.goods),
      profit,
      profitPerUnit: perUnit(profit, units),
      margin: netSales > 0 ? profit / netSales : null,
    },
    profit: insightsOf(profits, await monthsIn(tx, span)),
  }
}

export const profitBuilders = {
  'profit-by-month': profitByMonth,
  'profit-by-product': profitByProduct,
}
