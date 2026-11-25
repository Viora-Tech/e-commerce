/** The order-level amounts RapidShyp's order APIs take, so it collects what the admin shows. */

import type { CreateShipmentInput } from '@commerce/shipping'

const rupees = (paise: number) => Math.round(paise) / 100

/**
 * RapidShyp works out what the courier collects from the items (`unitPrice` x `units`) plus
 * `shippingCharges` and `codCharges`, less `totalDiscount` and, on a COD order, less
 * `prepaidAmount` (docs: Forward B2C > Create Order and the B2C Wrapper API; both name these
 * fields). Until 23 Nov 2026 only the items went, at their prices before any coupon, so a COD
 * order with a coupon or a shipping fee could be collected at the wrong amount.
 *
 * The booking carries the parcel's value and the amount to collect, not the order's breakdown,
 * so the gap between the items and the parcel's value goes as one line: above the items it is
 * the shipping (and fees), below it the discount. On COD, a collect amount below the value is
 * the part already paid (`prepaidAmount`), and one above it is a COD fee (`codCharges`). The
 * collect amount RapidShyp works out is then exactly `codAmountPaise`.
 */
export function orderAmounts(
  input: Pick<CreateShipmentInput, 'lines' | 'paymentMode' | 'codAmountPaise' | 'valuePaise'>,
) {
  const itemsPaise = input.lines.reduce(
    (sum, l) => sum + Math.round(l.unitPricePaise) * l.quantity,
    0,
  )
  const valuePaise = Math.max(Math.round(input.valuePaise), 0)
  const amounts = {
    shippingCharges: rupees(Math.max(valuePaise - itemsPaise, 0)),
    totalDiscount: rupees(Math.max(itemsPaise - valuePaise, 0)),
    codCharges: 0,
    prepaidAmount: 0,
  }
  if (input.paymentMode !== 'cod') return amounts
  const collectPaise = Math.max(Math.round(input.codAmountPaise), 0)
  return {
    ...amounts,
    codCharges: rupees(Math.max(collectPaise - valuePaise, 0)),
    prepaidAmount: rupees(Math.max(valuePaise - collectPaise, 0)),
  }
}
