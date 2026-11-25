/**
 * The order-level amounts Shiprocket's Create Order (`POST /orders/create/adhoc`) takes, so the
 * courier collects on delivery exactly what the admin shows.
 *
 * Shiprocket works the order total (the COD amount on a `payment_method: "COD"` order) out as
 * `sub_total + shipping_charges + giftwrap_charges + transaction_charges - total_discount`
 * (field names from its API collection, "Create Custom Order"; `sub_total` is "the sub-total
 * amount of the items in your order"). Until 23 Nov 2026 only `sub_total` went, set to the
 * parcel's value: the COD amount typed in Create shipment never reached Shiprocket, so a COD
 * order with a COD fee, or with part of it already paid (store credit), was collected at the
 * parcel's value instead.
 *
 * The booking carries the items, the parcel's value and the amount to collect, not the order's
 * breakdown (the same as RapidShyp's `./amounts` there). So `sub_total` is the items, and the
 * gap to the parcel's value goes as one field: above the items it is the shipping (and fees),
 * below it the discount. On COD a collect amount above the value is a COD fee
 * (`transaction_charges`), and one below it the part already paid, which Shiprocket has no field
 * for, so it joins `total_discount`. The total Shiprocket works out is then `codAmountPaise`
 * (COD) or the parcel's value (prepaid).
 */

import type { CreateShipmentInput } from '@commerce/shipping'

const rupees = (paise: number) => Math.round(paise) / 100

export type ShiprocketOrderAmounts = {
  sub_total: number
  shipping_charges: number
  transaction_charges: number
  total_discount: number
}

export function orderAmounts(
  input: Pick<CreateShipmentInput, 'lines' | 'paymentMode' | 'codAmountPaise' | 'valuePaise'>,
): ShiprocketOrderAmounts {
  const itemsPaise = input.lines.reduce(
    (sum, l) => sum + Math.round(l.unitPricePaise) * l.quantity,
    0,
  )
  const valuePaise = Math.max(Math.round(input.valuePaise), 0)
  const collectPaise =
    input.paymentMode === 'cod' ? Math.max(Math.round(input.codAmountPaise), 0) : valuePaise
  return {
    sub_total: rupees(itemsPaise),
    shipping_charges: rupees(Math.max(valuePaise - itemsPaise, 0)),
    transaction_charges: rupees(Math.max(collectPaise - valuePaise, 0)),
    total_discount: rupees(
      Math.max(itemsPaise - valuePaise, 0) + Math.max(valuePaise - collectPaise, 0),
    ),
  }
}
