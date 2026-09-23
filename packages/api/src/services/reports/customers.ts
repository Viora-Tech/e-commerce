import type { StoreTx } from '@commerce/db'
import { address, customer, order } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import { istIsoDate } from '../analytics-buckets'
import {
  byDesc,
  counted,
  groupBy,
  type ReportBuilder,
  type ReportSpan,
  ratio,
  sumOf,
  withShare,
} from './types'

const TOP_CUSTOMERS = 100

type BuyerOrder = {
  id: string
  buyer: string
  placedAt: Date
  totalPaise: number
  customerId: string | null
  email: string | null
  stateCode: string | null
}

/**
 * Every counted order the store has taken, keyed by buyer: the customer when
 * there is one, else the email, else the order itself. "New" and "returning"
 * need the whole history, not just the range.
 */
async function buyerOrders(tx: StoreTx): Promise<BuyerOrder[]> {
  const rows = await tx
    .select({
      id: order.id,
      placedAt: order.placedAt,
      totalPaise: order.totalPaise,
      customerId: order.customerId,
      email: order.email,
      stateCode: address.stateCode,
    })
    .from(order)
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(counted)
  return rows
    .map((r) => ({ ...r, buyer: r.customerId ?? r.email?.trim().toLowerCase() ?? r.id }))
    .sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime())
}

/** First order id per buyer; history is sorted oldest first. */
function firstOrders(history: BuyerOrder[]): Map<string, BuyerOrder> {
  const out = new Map<string, BuyerOrder>()
  for (const o of history) if (!out.has(o.buyer)) out.set(o.buyer, o)
  return out
}

const inSpan = (span: ReportSpan) => (o: BuyerOrder) =>
  o.placedAt >= span.from && o.placedAt < span.to

export const customerBuilders: Record<string, ReportBuilder> = {
  'customers-over-time': async (tx, span) => {
    const history = await buyerOrders(tx)
    const first = firstOrders(history)
    const orders = history.filter(inSpan(span))
    const isNew = (o: BuyerOrder) => first.get(o.buyer)?.id === o.id
    const byDay = groupBy(orders, (o) => istIsoDate(o.placedAt))
    const tally = (group: BuyerOrder[]) => {
      const buyers = new Set(group.map((o) => o.buyer))
      const fresh = new Set(group.filter(isNew).map((o) => o.buyer))
      return {
        customers: buyers.size,
        newCustomers: fresh.size,
        returningCustomers: buyers.size - fresh.size,
        orders: group.length,
      }
    }
    return {
      rows: span.days.map((d) => ({ key: d, values: { day: d, ...tally(byDay.get(d) ?? []) } })),
      totals: tally(orders),
    }
  },

  'first-time-vs-returning': async (tx, span) => {
    const history = await buyerOrders(tx)
    const first = firstOrders(history)
    const orders = history.filter(inSpan(span))
    const total = sumOf(orders, (o) => o.totalPaise)
    const rows = [
      ...groupBy(orders, (o) => (first.get(o.buyer)?.id === o.id ? 'new' : 'returning')),
    ]
      .map(([segment, group]) => {
        const totalSales = sumOf(group, (o) => o.totalPaise)
        return {
          key: segment,
          values: {
            segment,
            customers: new Set(group.map((o) => o.buyer)).size,
            orders: group.length,
            totalSales,
            aov: Math.round(totalSales / group.length),
          },
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
    return {
      rows: withShare(rows, 'totalSales', total),
      totals: {
        customers: new Set(orders.map((o) => o.buyer)).size,
        orders: orders.length,
        totalSales: total,
        aov: orders.length > 0 ? Math.round(total / orders.length) : null,
        share: orders.length > 0 ? 1 : null,
      },
    }
  },

  /** Buyers whose first order falls in the range, by IST month, followed to today. */
  'customer-cohorts': async (tx, span) => {
    const history = await buyerOrders(tx)
    const first = [...firstOrders(history).values()].filter(inSpan(span))
    const byBuyer = groupBy(history, (o) => o.buyer)
    const tally = (buyers: BuyerOrder[]) => {
      const lifetime = buyers.flatMap((b) => byBuyer.get(b.buyer) ?? [])
      const repeat = buyers.filter((b) => (byBuyer.get(b.buyer)?.length ?? 0) > 1).length
      const sales = sumOf(lifetime, (o) => o.totalPaise)
      return {
        customers: buyers.length,
        repeatCustomers: repeat,
        repeatRate: ratio(repeat, buyers.length),
        orders: lifetime.length,
        lifetimeSales: sales,
        salesPerCustomer: buyers.length > 0 ? Math.round(sales / buyers.length) : null,
      }
    }
    const rows = [...groupBy(first, (o) => istIsoDate(o.placedAt).slice(0, 7))].map(
      ([month, buyers]) => ({ key: month, values: { cohort: month, ...tally(buyers) } }),
    )
    return { rows, totals: tally(first) }
  },

  'top-customers': async (tx, span) => {
    const orders = (await buyerOrders(tx)).filter(inSpan(span))
    const ids = [...new Set(orders.map((o) => o.customerId).filter((v): v is string => !!v))]
    const known =
      ids.length > 0
        ? await tx
            .select({ id: customer.id, name: customer.name, email: customer.email })
            .from(customer)
            .where(inArray(customer.id, ids))
        : []
    const names = new Map(known.map((c) => [c.id, c]))
    const rows = [...groupBy(orders, (o) => o.buyer)]
      .map(([buyer, group]) => {
        const last = group.at(-1) as BuyerOrder
        const known = last.customerId ? names.get(last.customerId) : undefined
        const totalSales = sumOf(group, (o) => o.totalPaise)
        return {
          key: buyer,
          values: {
            customer: known?.name ?? null,
            email: known?.email ?? last.email,
            state: last.stateCode,
            orders: group.length,
            totalSales,
            aov: Math.round(totalSales / group.length),
            lastOrder: istIsoDate(last.placedAt),
          },
        }
      })
      .sort(byDesc('totalSales'))
      .slice(0, TOP_CUSTOMERS)
    const total = sumOf(orders, (o) => o.totalPaise)
    return {
      rows,
      totals: {
        orders: orders.length,
        totalSales: total,
        aov: orders.length > 0 ? Math.round(total / orders.length) : null,
      },
    }
  },
}
