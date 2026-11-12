/** SOURCE OF TRUTH: shipping margin and booked insurance tests — WHAT: the margin subtracts the
 * insurance cost booking recorded (Delhivery Protect) over checkout's, per parcel too / WHY: the
 * order page's margin must match what the drawer showed and the shipment recorded. */
import { describe, expect, it } from 'vitest'
import { shippingMargin } from './margin'
import { protectFeePaise } from './protect'

describe('shippingMargin with the insurance booking recorded', () => {
  // ₹8,999 of mouse pads on Delhivery direct, insured: Protect at 0.40% is ₹36.
  const protect = protectFeePaise(899_900, 40)

  it('subtracts the booked Protect fee instead of checkout’s empty rate', () => {
    const delivery = { courierCostPaise: 9000, insured: true, insurancePaise: null }
    const before = shippingMargin(delivery, 15_000, 9500)
    expect(before.insurancePaise).toBe(0)
    const m = shippingMargin(delivery, 15_000, 9500, {}, { insurancePaise: protect })
    expect(m.insurancePaise).toBe(3600)
    expect(m.marginPaise).toBe(15_000 - 9500 - 3600)
  })

  it('booked uninsured: no insurance, whatever checkout priced', () => {
    const delivery = { courierCostPaise: 9000, insured: true, insurancePaise: 3600 }
    expect(shippingMargin(delivery, 15_000, 9500, {}, { insurancePaise: 0 }).insurancePaise).toBe(0)
  })

  it('not booked yet (or booked before costs were recorded): checkout’s insurance', () => {
    const delivery = { courierCostPaise: 9000, insured: true, insurancePaise: 3600 }
    expect(
      shippingMargin(delivery, 15_000, null, {}, { insurancePaise: null }).insurancePaise,
    ).toBe(3600)
  })

  it('a split cart adds every parcel’s own booked insurance', () => {
    const delivery = {
      courierCostPaise: null,
      insured: true,
      insurancePaise: null,
      parcels: [
        {
          locationId: 'a',
          onHold: false,
          fulfillmentOrderId: 'fo-a',
          courierCostPaise: 6000,
          insured: true,
          insurancePaise: 2000,
        },
        {
          locationId: 'b',
          onHold: false,
          fulfillmentOrderId: 'fo-b',
          courierCostPaise: 7000,
          insured: true,
          insurancePaise: 2000,
        },
      ],
    } as unknown as Parameters<typeof shippingMargin>[0]
    const m = shippingMargin(
      delivery,
      20_000,
      null,
      { 'fo-a': 6500 },
      { parcels: { 'fo-a': protect } },
    )
    // Parcel A booked (₹65 + ₹36 Protect); parcel B still on its quote (₹70 + ₹20).
    expect(m.insurancePaise).toBe(3600 + 2000)
    expect(m.courierPaise).toBe(6500 + 7000)
    expect(m.marginPaise).toBe(20_000 - 13_500 - 5600)
  })
})
