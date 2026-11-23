/**
 * What a Shiprocket booking really was: the courier Shiprocket put the AWB with, and what it
 * charges for it. Shiprocket can book another courier than the one picked in the rate table
 * (or its own recommended one when none was picked), and its rate quote is not the charge it
 * takes from the wallet, so both are read back from Shiprocket after the AWB (23 Nov 2026, the
 * same fix as RapidShyp's, #2082 / #2088):
 *
 *   POST /courier/assign/awb  -> response.data { awb_code, courier_company_id, courier_name }
 *   GET  /orders/show/{id}    -> data.awb_data.charges { freight_charges, cod_charges, ... }
 *
 * The charge read is best-effort: when Shiprocket has not priced the AWB yet, or the call fails,
 * no charge is returned and the merchant types it in the order's Profit card (the quote is never
 * saved, `quoteIsCharge = false`). Field names from Shiprocket's API collection ("Get Order
 * Details"); not yet seen on a live account.
 */

import type { CreateShipmentResult } from '@commerce/shipping'

export type AssignedCourier = {
  awb_code?: string
  courier_name?: string
  courier_company_id?: number | string
}

/** The courier the AWB went to, as `bookedService` (its id is the rate table's `serviceId`). */
export function bookedService(
  data: AssignedCourier | undefined,
): Pick<CreateShipmentResult, 'bookedService'> {
  const id = data?.courier_company_id != null ? String(data.courier_company_id).trim() : ''
  const label = data?.courier_name?.trim() ?? ''
  if (!id && !label) return {}
  return { bookedService: { ...(id ? { id } : {}), ...(label ? { label } : {}) } }
}

type Charges = {
  freight_charges?: number | string | null
  applied_weight_amount?: number | string | null
  cod_charges?: number | string | null
}

export type OrderShowResponse = { data?: { awb_data?: { charges?: Charges | null } | null } }

const paise = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/**
 * The booked AWB's charge, in paise: the freight (`freight_charges`, else
 * `applied_weight_amount`, the freight at the applied weight) plus the COD charge Shiprocket
 * lists beside it. Undefined while Shiprocket has no freight for it.
 */
export function chargeOf(answer: OrderShowResponse | undefined): number | undefined {
  const c = answer?.data?.awb_data?.charges
  const freight = paise(c?.freight_charges) || paise(c?.applied_weight_amount)
  return freight > 0 ? freight + paise(c?.cod_charges) : undefined
}

/** Reads the charge for Shiprocket order `orderId`; never throws, the booking stands either way. */
export async function bookedCharge(
  get: <T>(path: string) => Promise<T>,
  orderId: number | string | undefined,
): Promise<Pick<CreateShipmentResult, 'chargePaise'>> {
  const id = Number(orderId)
  if (!Number.isInteger(id) || id <= 0) return {}
  const chargePaise = chargeOf(
    await get<OrderShowResponse>(`/orders/show/${id}`).catch(() => undefined),
  )
  return chargePaise ? { chargePaise } : {}
}
