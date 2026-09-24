import { describe, expect, it } from 'vitest'
import {
  checkoutDuePaise,
  deriveFulfillmentStatus,
  deriveLifecycle,
  derivePaymentStatus,
  importedOrderStatuses,
  isCheckoutSettled,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type PaymentFacts,
} from './aggregate-status'

const pay = (
  status: string,
  amountPaise: number,
  extra: Partial<Omit<PaymentFacts, 'status' | 'amountPaise'>> = {},
): PaymentFacts => ({ status, amountPaise, refundNeeded: false, refundedPaise: 0, ...extra })

describe('derivePaymentStatus', () => {
  const cases: [string, number, PaymentFacts[], OrderPaymentStatus][] = [
    ['no attempts', 1000, [], 'unpaid'],
    ['created attempt', 1000, [pay('created', 1000)], 'unpaid'],
    ['pending COD', 1000, [pay('pending', 1000)], 'unpaid'],
    ['failed then pending', 1000, [pay('failed', 1000), pay('pending', 1000)], 'unpaid'],
    ['authorised hold', 1000, [pay('authorized', 1000)], 'authorized'],
    ['captured in full', 1000, [pay('captured', 1000)], 'paid'],
    ['captured more than total', 1000, [pay('captured', 1200)], 'paid'],
    [
      'gift card part + pending gateway',
      1000,
      [pay('captured', 300), pay('pending', 700)],
      'partially_paid',
    ],
    [
      'gift card part + gateway capture',
      1000,
      [pay('captured', 300), pay('captured', 700)],
      'paid',
    ],
    ['deposit only', 1000, [pay('captured', 250)], 'partially_paid'],
    ['deposit and balance', 1000, [pay('captured', 250), pay('captured', 750)], 'paid'],
    ['part refunded', 1000, [pay('captured', 1000, { refundedPaise: 200 })], 'partially_refunded'],
    ['fully refunded', 1000, [pay('refunded', 1000, { refundedPaise: 1000 })], 'refunded'],
    [
      'refunds across two captures',
      1000,
      [pay('refunded', 300, { refundedPaise: 300 }), pay('captured', 700, { refundedPaise: 700 })],
      'refunded',
    ],
    [
      'late capture on a cancelled order',
      1000,
      [pay('captured', 1000, { refundNeeded: true })],
      'refund_needed',
    ],
    [
      'duplicate capture flagged, not yet returned',
      1000,
      [pay('captured', 1000), pay('captured', 1000, { refundNeeded: true })],
      'refund_needed',
    ],
    [
      'flagged capture returned',
      1000,
      [pay('captured', 1000), pay('refunded', 1000, { refundNeeded: true, refundedPaise: 1000 })],
      'paid',
    ],
    ['zero-total order', 0, [], 'paid'],
    ['flagged hold is ignored', 1000, [pay('authorized', 1000, { refundNeeded: true })], 'unpaid'],
  ]
  it.each(cases)('%s', (_name, totalPaise, payments, expected) => {
    expect(derivePaymentStatus({ totalPaise, payments })).toBe(expected)
  })
})

describe('checkout settlement', () => {
  it('asks only for the deposit while a balance is open', () => {
    const o = { totalPaise: 1000, balanceDuePaise: 750, balancePaidAt: null }
    expect(checkoutDuePaise(o)).toBe(250)
    expect(isCheckoutSettled(o, [pay('captured', 250)])).toBe(true)
    expect(isCheckoutSettled(o, [pay('captured', 100)])).toBe(false)
  })

  it('asks for the whole order once the balance is settled or when there is none', () => {
    expect(
      checkoutDuePaise({ totalPaise: 1000, balanceDuePaise: 0, balancePaidAt: new Date() }),
    ).toBe(1000)
    const full = { totalPaise: 1000, balanceDuePaise: null, balancePaidAt: null }
    expect(isCheckoutSettled(full, [pay('captured', 300), pay('pending', 700)])).toBe(false)
    expect(isCheckoutSettled(full, [pay('captured', 300), pay('captured', 700)])).toBe(true)
    expect(isCheckoutSettled(full, [pay('captured', 1000, { refundNeeded: true })])).toBe(false)
  })
})

const line = (quantity: number, fulfilledQuantity: number, giftCard = false) => ({
  quantity,
  fulfilledQuantity,
  giftCard,
})
const ship = (status: string) => ({ status })

describe('deriveFulfillmentStatus', () => {
  const cases: [
    string,
    ReturnType<typeof line>[],
    ReturnType<typeof ship>[],
    Date | null,
    OrderFulfillmentStatus,
  ][] = [
    ['nothing packed', [line(2, 0)], [], null, 'unfulfilled'],
    ['no lines', [], [], null, 'unfulfilled'],
    ['some packed', [line(2, 1)], [], null, 'partially_fulfilled'],
    ['one of two lines packed', [line(1, 1), line(1, 0)], [], null, 'partially_fulfilled'],
    ['all packed, no courier', [line(2, 2)], [], null, 'fulfilled'],
    ['label created', [line(2, 2)], [ship('created')], null, 'fulfilled'],
    ['picked up', [line(2, 2)], [ship('picked_up')], null, 'shipped'],
    ['out for delivery', [line(2, 2)], [ship('out_for_delivery')], null, 'shipped'],
    ['delivered', [line(2, 2)], [ship('delivered')], null, 'delivered'],
    ['delivered by hand', [line(2, 2)], [], new Date(), 'delivered'],
    ['hand delivery ignored while unpacked', [line(2, 0)], [], new Date(), 'unfulfilled'],
    [
      'one of two parcels delivered',
      [line(2, 2)],
      [ship('delivered'), ship('in_transit')],
      null,
      'partially_delivered',
    ],
    ['partial pack delivered', [line(2, 1)], [ship('delivered')], null, 'partially_delivered'],
    ['RTO', [line(2, 2)], [ship('rto')], null, 'returned'],
    ['cancelled label ignored', [line(2, 2)], [ship('cancelled')], null, 'fulfilled'],
    [
      'cancelled then rebooked',
      [line(2, 2)],
      [ship('cancelled'), ship('in_transit')],
      null,
      'shipped',
    ],
    ['over-packed line counts as packed', [line(1, 3)], [], null, 'fulfilled'],
    ['gift cards issued', [line(1, 1, true)], [], null, 'fulfilled'],
  ]
  it.each(cases)('%s', (_name, lines, shipments, deliveredAt, expected) => {
    expect(deriveFulfillmentStatus({ lines, shipments, deliveredAt })).toBe(expected)
  })
})

describe('deriveLifecycle', () => {
  it('keeps drafts and cancelled orders as they are', () => {
    for (const current of ['draft', 'cancelled'] as const) {
      expect(
        deriveLifecycle({
          current,
          payment: 'paid',
          fulfillment: 'delivered',
          hasPhysicalLines: true,
        }),
      ).toBe(current)
    }
  })

  it('completes once paid and delivered, and reopens when that stops being true', () => {
    const base = { current: 'open' as const, hasPhysicalLines: true }
    expect(deriveLifecycle({ ...base, payment: 'paid', fulfillment: 'delivered' })).toBe(
      'completed',
    )
    expect(deriveLifecycle({ ...base, payment: 'refunded', fulfillment: 'delivered' })).toBe(
      'completed',
    )
    expect(deriveLifecycle({ ...base, payment: 'unpaid', fulfillment: 'delivered' })).toBe('open')
    expect(deriveLifecycle({ ...base, payment: 'paid', fulfillment: 'shipped' })).toBe('open')
    expect(deriveLifecycle({ ...base, payment: 'refund_needed', fulfillment: 'delivered' })).toBe(
      'open',
    )
    expect(
      deriveLifecycle({ ...base, current: 'completed', payment: 'paid', fulfillment: 'returned' }),
    ).toBe('open')
  })

  it('completes a gift-card-only order once issued', () => {
    expect(
      deriveLifecycle({
        current: 'open',
        payment: 'paid',
        fulfillment: 'fulfilled',
        hasPhysicalLines: false,
      }),
    ).toBe('completed')
  })
})

describe('importedOrderStatuses', () => {
  it('reads the source platform', () => {
    expect(
      importedOrderStatuses({ financialStatus: 'paid', fulfillmentStatus: 'fulfilled' }),
    ).toEqual({ status: 'completed', paymentStatus: 'paid', fulfillmentStatus: 'fulfilled' })
    expect(importedOrderStatuses({ financialStatus: 'pending', fulfillmentStatus: null })).toEqual({
      status: 'open',
      paymentStatus: 'unpaid',
      fulfillmentStatus: 'unfulfilled',
    })
    expect(
      importedOrderStatuses({
        financialStatus: 'refunded',
        fulfillmentStatus: 'partial',
        cancelledAt: '2025-01-01',
      }),
    ).toEqual({
      status: 'cancelled',
      paymentStatus: 'refunded',
      fulfillmentStatus: 'partially_fulfilled',
    })
    expect(
      importedOrderStatuses({ financialStatus: 'voided', fulfillmentStatus: 'restocked' }),
    ).toEqual({ status: 'open', paymentStatus: 'unpaid', fulfillmentStatus: 'returned' })
  })
})
