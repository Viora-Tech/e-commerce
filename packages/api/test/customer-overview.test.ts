import { describe, expect, it } from 'vitest'
import { buildCustomerOverviewSeries } from '../src/services/customer-overview'

/** Midday IST on the given date, so the bucket cannot slip either side of midnight. */
const at = (iso: string) => new Date(`${iso}T06:30:00.000Z`)

const DAYS = ['2026-03-01', '2026-03-02', '2026-03-03']

describe('buildCustomerOverviewSeries', () => {
  it('counts each buyer once a day and marks the repeat ones', () => {
    const series = buildCustomerOverviewSeries({
      days: DAYS,
      orders: [
        { at: at('2026-03-01'), customerId: 'asha', repeat: true },
        // Second order the same day: still one active customer.
        { at: at('2026-03-01'), customerId: 'asha', repeat: true },
        { at: at('2026-03-01'), customerId: 'ravi', repeat: false },
        { at: at('2026-03-03'), customerId: 'asha', repeat: true },
      ],
      visitors: [10, 0, 5],
    })
    expect(series.activeCustomers).toEqual([2, 0, 1])
    expect(series.repeatCustomers).toEqual([1, 0, 1])
  })

  it('never merges guest orders, since they have no customer record', () => {
    const series = buildCustomerOverviewSeries({
      days: DAYS,
      orders: [
        { at: at('2026-03-02'), customerId: null, repeat: false },
        { at: at('2026-03-02'), customerId: null, repeat: false },
      ],
      visitors: [0, 0, 0],
    })
    expect(series.activeCustomers).toEqual([0, 2, 0])
  })

  it('reads conversion as orders per visitor, and zero when nobody visited', () => {
    const series = buildCustomerOverviewSeries({
      days: DAYS,
      orders: [
        { at: at('2026-03-01'), customerId: 'asha', repeat: false },
        { at: at('2026-03-01'), customerId: 'ravi', repeat: false },
        { at: at('2026-03-02'), customerId: 'asha', repeat: true },
      ],
      visitors: [8, 0, 4],
    })
    expect(series.shopVisitors).toEqual([8, 0, 4])
    expect(series.conversionRate).toEqual([25, 0, 0])
  })

  it('drops orders outside the window and pads missing visitor days', () => {
    const series = buildCustomerOverviewSeries({
      days: DAYS,
      orders: [
        { at: at('2026-02-27'), customerId: 'asha', repeat: false },
        { at: at('2026-03-02'), customerId: 'ravi', repeat: false },
      ],
      visitors: [3],
    })
    expect(series.days).toEqual(DAYS)
    expect(series.activeCustomers).toEqual([0, 1, 0])
    expect(series.shopVisitors).toEqual([3, 0, 0])
  })
})
