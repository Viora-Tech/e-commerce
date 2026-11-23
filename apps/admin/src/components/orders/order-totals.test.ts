import { describe, expect, it } from 'vitest'
import { orderDetailContent } from '@/data/order-detail'
import { formatters } from '@/lib/format'
import type { OrderDetail } from './order-detail-types'
import { totalRows } from './order-totals'

const fmt = formatters('en')

const order = (shippingRateName: string | null) =>
  ({
    subtotalPaise: 100_000,
    discountPaise: 0,
    discountCode: null,
    discountLabel: null,
    shippingPaise: 9_900,
    shippingRateName,
    paymentAdjustmentPaise: 0,
    paymentAdjustmentLabel: null,
    taxBreakdown: null,
    taxOrigin: null,
    totalPaise: 109_900,
    balance: { capturedPaise: 109_900, refundedPaise: 0, balancePaise: 0 },
  }) as unknown as OrderDetail

const shippingRow = (o: OrderDetail) =>
  totalRows(o, orderDetailContent, fmt).find((r) => r.value === fmt.money(9_900))

describe('totalRows shipping', () => {
  it('labels the row Shipping and keeps the checkout rate as a note', () => {
    // The rate named one courier, but another may carry the parcel: never claim it in the label.
    const row = shippingRow(order('Standard · Courier X'))
    expect(row?.label).toBe('Shipping')
    expect(row?.detail).toBe('Standard · Courier X')
  })

  it('shows no note when the order has no rate name', () => {
    const row = shippingRow(order(null))
    expect(row?.label).toBe('Shipping')
    expect(row?.detail).toBeUndefined()
    expect(shippingRow(order('  '))?.detail).toBeUndefined()
  })
})
