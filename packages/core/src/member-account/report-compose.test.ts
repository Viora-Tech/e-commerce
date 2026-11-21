/** SOURCE OF TRUTH: team report layout data tests — WHAT: made-up figures in, the formatted report out: net sales, changes, best bar, history, sources, to-dos / WHY: the email only lays this out, so a wrong arrow or label here is what every member reads */
import { describe, expect, it } from 'vitest'
import {
  composeReport,
  type PeriodTotals,
  percentChange,
  pointChange,
  type ReportFigures,
} from './report-compose'
import { dailyPeriod, monthlyPeriod, weeklyPeriod } from './report-periods'

const ist = (wall: string) => new Date(`${wall}:00.000+05:30`)
const ADMIN = 'https://admin.example.com/'

const totals = (over: Partial<PeriodTotals> = {}): PeriodTotals => ({
  orders: 96,
  trackedOrders: 90,
  revenuePaise: 18_432_000,
  returningOrders: 24,
  newCustomers: 38,
  sessions: 4_000,
  breakdown: {
    grossPaise: 19_680_000,
    discountsPaise: 828_000,
    returnsPaise: 420_000,
    shippingPaise: 0,
    taxPaise: 0,
  },
  ...over,
})

const figures = (over: Partial<ReportFigures> = {}): ReportFigures => ({
  storeName: 'Test Shop',
  now: totals(),
  previous: totals({
    orders: 84,
    trackedOrders: 80,
    sessions: 4_000,
    returningOrders: 26,
    breakdown: {
      grossPaise: 16_000_000,
      discountsPaise: 378_000,
      returnsPaise: 0,
      shippingPaise: 0,
      taxPaise: 0,
    },
  }),
  buckets: [1, 2, 3, 4, 5, 9, 2].map((k) => ({ salesPaise: k * 1_000_000, orders: k * 2 })),
  historyNetPaise: [12_100_000, 13_800_000, 11_200_000, 15_622_000, 18_432_000],
  sellers: [
    { title: 'Sample mouse', detail: 'Blue', units: 31, revenuePaise: 4_030_000, imageUrl: null },
  ],
  sources: [
    { channel: 'direct', orders: 12 },
    { channel: 'social', orders: 62 },
    { channel: 'organic_search', orders: 21 },
    { channel: 'whatsapp', orders: 5 },
    { channel: 'sms', orders: 0 },
  ],
  toShip: null,
  abandoned: { carts: 41, valuePaise: 7_860_000 },
  ...over,
})

describe('change labels', () => {
  it('rounds to a whole percent, arrow by direction, null with nothing before', () => {
    expect(percentChange(118, 100)).toEqual({ label: '▲ 18%', up: true })
    expect(percentChange(97, 100)).toEqual({ label: '▼ 3%', up: false })
    expect(percentChange(5, 0)).toBeNull()
    expect(pointChange(0.023, 0.019)).toEqual({ label: '▲ 0.4 pt', up: true })
    expect(pointChange(0.22, 0.24)).toEqual({ label: '▼ 2 pt', up: false })
  })
})

describe('weekly report', () => {
  const r = composeReport(weeklyPeriod(ist('2026-11-16T09:30')), figures(), ADMIN)

  it('states net sales from the sales breakdown against last week', () => {
    expect(r.kicker).toBe('Weekly report · Week 46')
    expect(r.title).toBe('Your week at Test Shop.')
    expect(r.netLabel).toBe('₹1,84,320')
    expect(r.change).toEqual({ label: '▲ 18%', up: true })
    expect(r.changeNote).toBe('vs ₹1,56,220 last week')
  })

  it('marks the best day and names it under the bars', () => {
    expect(r.bars.filter((b) => b.best).map((b) => b.label)).toEqual(['Sat'])
    expect(r.barNote).toBe('Saturday was your best day: 18 orders worth ₹90,000.')
  })

  it('has six figures with their changes', () => {
    expect(r.stats.map((s) => [s.label, s.value, s.change?.label])).toEqual([
      ['Orders', '96', '▲ 14%'],
      ['Visitors', '4,000', '▲ 0%'],
      ['Conversion', '2.3%', '▲ 0.3 pt'],
      ['Average order', '₹1,920', '▼ 13%'],
      ['New customers', '38', '▲ 0%'],
      ['Repeat buyers', '25%', '▼ 6 pt'],
    ])
    expect(r.vsLabel).toBe('vs last week')
  })

  it('ends the history with this week and lists sources biggest first', () => {
    expect(r.history.map((h) => h.label)).toEqual([
      '12 Oct',
      '19 Oct',
      '26 Oct',
      '2 Nov',
      'This week',
    ])
    expect(r.sources).toEqual([
      { label: 'Social', percent: 62 },
      { label: 'Search', percent: 21 },
      { label: 'Direct', percent: 12 },
      { label: 'WhatsApp', percent: 5 },
    ])
  })

  it('links the to-dos and the footer into the admin', () => {
    expect(r.todos).toEqual([
      {
        icon: '🛒',
        text: '41 carts were left at checkout, worth ₹78,600.',
        linkLabel: 'Send a reminder',
        url: 'https://admin.example.com/orders/abandoned-checkouts',
      },
    ])
    expect(r.todosFirst).toBe(false)
    expect(r.money).toEqual([
      { label: 'Gross sales', amount: '₹1,96,800' },
      { label: 'Discounts', amount: '− ₹8,280' },
      { label: 'Refunds', amount: '− ₹4,200' },
    ])
    expect(r.button).toEqual({
      label: 'Open your analytics',
      url: 'https://admin.example.com/analytics',
    })
    expect(r.settingsUrl).toBe('https://admin.example.com/account/notifications')
  })
})

describe('a quiet week', () => {
  it('hides the bars, sources and to-dos and states no change from nothing', () => {
    const empty = totals({
      orders: 0,
      trackedOrders: 0,
      revenuePaise: 0,
      returningOrders: 0,
      newCustomers: 0,
      sessions: 0,
      breakdown: {
        grossPaise: 0,
        discountsPaise: 0,
        returnsPaise: 0,
        shippingPaise: 0,
        taxPaise: 0,
      },
    })
    const r = composeReport(
      weeklyPeriod(ist('2026-11-16T09:30')),
      figures({
        now: empty,
        previous: empty,
        buckets: [],
        sellers: [],
        sources: [],
        abandoned: { carts: 0, valuePaise: 0 },
      }),
      ADMIN,
    )
    expect(r.netLabel).toBe('₹0')
    expect(r.change).toEqual({ label: '▲ 0%', up: true })
    expect(r.bars.some((b) => b.best)).toBe(false)
    expect(r.barNote).toBeNull()
    expect(r.sources).toEqual([])
    expect(r.todos).toEqual([])
    expect(r.money[2]).toEqual({ label: 'Refunds', amount: '₹0' })
  })
})

describe('monthly report', () => {
  it('names the month, its best week and a rise in refunds', () => {
    const r = composeReport(
      monthlyPeriod(ist('2026-11-01T09:30')),
      figures({ buckets: [1, 2, 9, 4, 3].map((k) => ({ salesPaise: k * 1_000_000, orders: k })) }),
      ADMIN,
    )
    expect(r.kicker).toBe('Monthly report · October 2026')
    expect(r.title).toBe('Your October at Test Shop.')
    expect(r.changeNote).toBe('vs ₹1,56,220 in September')
    expect(r.barNote).toBe('12–18 October was your best week: ₹90,000 from 9 orders.')
    expect(r.history.at(-1)?.label).toBe('October')
    expect(r.todos.map((t) => t.text)).toContain(
      'Refunds were 2.1% of sales, up from 0.0% in September.',
    )
  })
})

describe('daily summary', () => {
  it('shows three figures, the packing to-do first, and when orders came in', () => {
    const r = composeReport(
      dailyPeriod(ist('2026-11-18T09:30')),
      figures({
        buckets: [0, 1, 3, 2, 5, 1].map((k) => ({ salesPaise: k * 100_000, orders: k })),
        toShip: 9,
        abandoned: null,
      }),
      ADMIN,
    )
    expect(r.kicker).toBe('Daily summary · Tuesday')
    expect(r.title).toBe('Yesterday at Test Shop.')
    expect(r.changeNote).toBe('vs ₹1,56,220 last Tuesday')
    expect(r.stats).toHaveLength(3)
    expect(r.vsLabel).toBe('vs last Tue')
    expect(r.barNote).toBe('Most orders came in between 6 and 10 pm.')
    expect(r.todosFirst).toBe(true)
    expect(r.todos).toEqual([
      {
        icon: '📦',
        text: '9 orders are paid and ready to pack.',
        linkLabel: 'Pack orders',
        url: 'https://admin.example.com/orders',
      },
    ])
    expect(r.button.url).toBe('https://admin.example.com/orders')
  })
})
