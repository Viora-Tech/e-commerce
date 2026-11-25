import { describe, expect, it } from 'vitest'
import { orderDetailContent } from '@/data/order-detail'
import { formatters } from '@/lib/format'
import type { OrderDetail } from './order-detail-types'
import { totalRows } from './order-totals'

const fmt = formatters('en')

const order = (shippingRateName: string | null, extra: Record<string, unknown> = {}) =>
  ({
    lines: [{ quantity: 2 }],
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
    ...extra,
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

describe('totalRows layout', () => {
  it('notes the item count on Subtotal and the code on Discount', () => {
    const rows = totalRows(
      order(null, { discountPaise: 5_000, discountCode: 'DIWALI10', discountLabel: 'Diwali' }),
      orderDetailContent,
      fmt,
    )
    expect(rows[0]).toMatchObject({ label: 'Subtotal', detail: '2 items' })
    expect(rows[1]).toMatchObject({ label: 'Discount', detail: 'DIWALI10' })
  })

  it('starts what was paid with a rule after the total', () => {
    const rows = totalRows(order(null), orderDetailContent, fmt)
    const total = rows.findIndex((r) => r.strong)
    expect(rows[total + 1]).toMatchObject({ label: 'Paid by customer', rule: true })
  })

  it('folds GST into one included line with the split and GSTIN behind it', () => {
    const rows = totalRows(
      order(null, {
        taxBreakdown: {
          taxPaise: 16_780,
          cgstPaise: 8_390,
          sgstPaise: 8_390,
          igstPaise: 0,
          ratePercent: 18,
          interState: false,
        },
        taxOrigin: { gstin: '06AAAAA0000A1Z5', stateName: 'Haryana', stateCode: 'HR' },
      }),
      orderDetailContent,
      fmt,
    )
    const sum = rows.filter((r) => r.tax === 'sum')
    expect(sum).toHaveLength(1)
    expect(sum[0]?.label).toBe('GST (included)')
    expect(rows.filter((r) => r.tax === 'split').map((r) => r.label)).toEqual([
      'CGST 9%',
      'SGST 9%',
      'Billed from',
    ])
  })
})
