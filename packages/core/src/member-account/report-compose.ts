/** SOURCE OF TRUTH: team report layout data — WHAT: turns a period's counted figures into the formatted `PerformanceReport` the email lays out / WHY: pure, so every label, change arrow and hidden block is tested with made-up figures and no database */
import { formatMoney } from '@commerce/money'
import { type PerformanceReport, type ReportChange, reportCopy } from '@commerce/notifications'
import {
  averageOrderValue,
  breakdownLines,
  conversionRate,
  delta,
  returningRate,
  type SalesBreakdownSums,
} from '../analytics-figures'
import type { ReportPeriod } from './report-periods'

/** One period's counted figures (Analytics' rules: no drafts, cancelled or test orders). */
export type PeriodTotals = {
  orders: number
  /** Orders with sessions behind them, the ones that can convert (Analytics, audit #95). */
  trackedOrders: number
  /** Order totals, for the average order. */
  revenuePaise: number
  /** Orders from someone who had ordered before. */
  returningOrders: number
  /** Customers whose first counted order falls in the period. */
  newCustomers: number
  /** Real-shopper sessions (`totalSessions`). */
  sessions: number
  breakdown: SalesBreakdownSums
}

export type ReportFigures = {
  storeName: string
  now: PeriodTotals
  previous: PeriodTotals
  /** Sales after discounts and order counts, one per `period.buckets`. */
  buckets: { salesPaise: number; orders: number }[]
  /** Net sales, one per `period.history`. */
  historyNetPaise: number[]
  sellers: {
    title: string
    detail: string
    units: number
    revenuePaise: number
    imageUrl: string | null
  }[]
  /** Counted orders by attribution channel. */
  sources: { channel: string; orders: number }[]
  /** Daily only: paid orders waiting to be packed. */
  toShip: number | null
  /** Abandoned checkouts in the period not won back. */
  abandoned: { carts: number; valuePaise: number } | null
}

const SOURCE_ROWS = 4
const money = (paise: number) => formatMoney(paise, 'INR', { whole: true })
const short = (paise: number) => formatMoney(paise, 'INR', { compact: true })
/** Net sales as Analytics' sales breakdown states it: gross − discounts − returns. */
export const netSales = (b: SalesBreakdownSums) =>
  breakdownLines(b).find((l) => l.key === 'net')?.paise ?? 0
const minus = (paise: number) => (paise > 0 ? `− ${money(paise)}` : money(0))

/** "▲ 18%" or "▼ 3%"; null when there is nothing to compare against. */
export function percentChange(now: number, before: number): ReportChange | null {
  const d = delta(now, before)
  if (d === null) return null
  const pct = Math.round(Math.abs(d) * 100)
  return { label: `${d < 0 ? '▼' : '▲'} ${pct}%`, up: d >= 0 }
}

/** A rate's change in percentage points: "▲ 0.4 pt". */
export function pointChange(now: number, before: number): ReportChange {
  // From the rounded rates, so the change matches the two figures a reader sees.
  const pts = (Math.round(now * 1000) - Math.round(before * 1000)) / 10
  return {
    label: `${pts < 0 ? '▼' : '▲'} ${reportCopy.points(Math.abs(pts).toFixed(1).replace(/\.0$/, ''))}`,
    up: pts >= 0,
  }
}

const pct1 = (rate: number) => `${(rate * 100).toFixed(1)}%`
const pct0 = (rate: number) => `${Math.round(rate * 100)}%`

function stats(
  kind: ReportPeriod['kind'],
  now: PeriodTotals,
  before: PeriodTotals,
): PerformanceReport['stats'] {
  const s = reportCopy.stats
  const conv = conversionRate(now.trackedOrders, now.sessions)
  const convBefore = conversionRate(before.trackedOrders, before.sessions)
  const rows: PerformanceReport['stats'] = [
    {
      label: s.orders,
      value: String(now.orders),
      change: percentChange(now.orders, before.orders),
    },
    {
      label: s.visitors,
      value: now.sessions.toLocaleString('en-IN'),
      change: percentChange(now.sessions, before.sessions),
    },
    {
      label: s.conversion,
      value: pct1(conv),
      change: now.sessions && before.sessions ? pointChange(conv, convBefore) : null,
    },
  ]
  if (kind === 'daily') return rows
  const aov = averageOrderValue(now.revenuePaise, now.orders)
  const repeat = returningRate(now.returningOrders, now.orders)
  return [
    ...rows,
    {
      label: s.averageOrder,
      value: money(aov),
      change: percentChange(aov, averageOrderValue(before.revenuePaise, before.orders)),
    },
    {
      label: s.newCustomers,
      value: String(now.newCustomers),
      change: percentChange(now.newCustomers, before.newCustomers),
    },
    {
      label: s.repeatBuyers,
      value: pct0(repeat),
      change:
        now.orders && before.orders
          ? pointChange(repeat, returningRate(before.returningOrders, before.orders))
          : null,
    },
  ]
}

function todos(period: ReportPeriod, f: ReportFigures, admin: string): PerformanceReport['todos'] {
  const t = reportCopy.todos
  const out: PerformanceReport['todos'] = []
  if (f.toShip) out.push({ ...t.toShip(f.toShip), url: `${admin}/orders` })
  if (f.abandoned?.carts) {
    out.push({
      ...t.abandoned(f.abandoned.carts, money(f.abandoned.valuePaise)),
      url: `${admin}/orders/abandoned-checkouts`,
    })
  }
  if (period.kind === 'monthly') {
    const rate = (b: SalesBreakdownSums) => (b.grossPaise > 0 ? b.returnsPaise / b.grossPaise : 0)
    const now = rate(f.now.breakdown)
    const before = rate(f.previous.breakdown)
    if (now > before && now > 0) {
      out.push({
        ...t.refunds(pct1(now), pct1(before), period.labels.previousName),
        url: `${admin}/orders/returns`,
      })
    }
  }
  return out
}

function barNote(period: ReportPeriod, f: ReportFigures, best: number): string | null {
  const b = period.buckets[best]
  const figures = f.buckets[best]
  if (!b || !figures) return null
  const n = reportCopy.barNote
  if (period.kind === 'daily') return b.words ? n.daily(b.words[0], b.words[1]) : null
  return period.kind === 'weekly'
    ? n.weekly(b.name, figures.orders, money(figures.salesPaise))
    : n.monthly(b.name, money(figures.salesPaise), figures.orders)
}

/** The whole report for `period`, every value formatted, links into the admin at `adminUrl`. */
export function composeReport(
  period: ReportPeriod,
  f: ReportFigures,
  adminUrl: string,
): PerformanceReport {
  const c = reportCopy
  const kind = period.kind
  const admin = adminUrl.replace(/\/+$/, '')
  const netNow = netSales(f.now.breakdown)
  const netBefore = netSales(f.previous.breakdown)
  const top = Math.max(0, ...f.buckets.map((b) => b.salesPaise))
  const best = top > 0 ? f.buckets.findIndex((b) => b.salesPaise === top) : -1
  const tracked = f.sources.reduce((n, s) => n + s.orders, 0)
  const l = period.labels
  return {
    period: kind,
    kicker:
      kind === 'daily'
        ? c.kicker.daily(l.kicker)
        : kind === 'weekly'
          ? c.kicker.weekly(Number(l.kicker))
          : c.kicker.monthly(l.kicker),
    title:
      kind === 'daily'
        ? c.title.daily(f.storeName, period.today)
        : kind === 'weekly'
          ? c.title.weekly(f.storeName)
          : c.title.monthly(f.storeName, l.name),
    periodLabel: l.period,
    netLabel: money(netNow),
    change: percentChange(netNow, netBefore),
    changeNote:
      kind === 'daily'
        ? c.changeNote.daily(money(netBefore), l.previousName)
        : kind === 'weekly'
          ? c.changeNote.weekly(money(netBefore))
          : c.changeNote.monthly(money(netBefore), l.previousName),
    bars: period.buckets.map((b, i) => {
      const value = f.buckets[i]?.salesPaise ?? 0
      return { label: b.label, valueLabel: short(value), value, best: i === best }
    }),
    barNote: best >= 0 ? barNote(period, f, best) : null,
    stats: stats(kind, f.now, f.previous),
    vsLabel:
      kind === 'daily'
        ? c.vsLabel.daily(l.previousShort)
        : kind === 'weekly'
          ? c.vsLabel.weekly()
          : c.vsLabel.monthly(l.previousName),
    historyTitle: c.historyTitle[kind],
    history: period.history.map((h, i, all) => ({
      label: i === all.length - 1 ? (c.historyNow[kind] ?? h.label) : h.label,
      value: short(f.historyNetPaise[i] ?? 0),
    })),
    sellersTitle: c.sellersTitle[kind],
    sellers: f.sellers.map((s) => ({
      title: s.title,
      detail: s.detail,
      soldLabel: c.sold(s.units),
      amountLabel: money(s.revenuePaise),
      imageUrl: s.imageUrl,
    })),
    sources:
      tracked > 0
        ? [...f.sources]
            .sort((a, b) => b.orders - a.orders)
            .slice(0, SOURCE_ROWS)
            .map((s) => ({
              label: c.sources[s.channel] ?? c.otherSource,
              percent: Math.round((s.orders / tracked) * 100),
            }))
        : [],
    todoTitle: c.todoTitle[kind],
    todos: todos(period, f, admin),
    todosFirst: kind === 'daily',
    moneyTitle: c.moneyTitle[kind],
    money: [
      { label: c.money.gross, amount: money(f.now.breakdown.grossPaise) },
      { label: c.money.discounts, amount: minus(f.now.breakdown.discountsPaise) },
      { label: c.money.refunds, amount: minus(f.now.breakdown.returnsPaise) },
    ],
    button: {
      label: c.button[kind],
      url: kind === 'daily' ? `${admin}/orders` : `${admin}/analytics`,
    },
    analyticsUrl: `${admin}/analytics`,
    settingsUrl: `${admin}/account/notifications`,
    footer: c.footer[kind],
  }
}
