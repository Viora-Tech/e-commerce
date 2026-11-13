import type { CreateShipmentInput } from './types'

/**
 * The order id an aggregator (RapidShyp, Shiprocket) is sent: the order number merchants search
 * for in its panel (`2471`), not our internal UUID. A later booking of the same order gets a
 * suffix (`2471-2`, `2471-3`), since the courier refuses a second order with an id it has.
 * `skip` moves past ids the courier already holds (its "order id already exists" refusal).
 */
export function courierOrderRef(
  input: Pick<CreateShipmentInput, 'orderNumber' | 'shipmentNumber'>,
  skip = 0,
): string {
  const n = Math.max(1, Math.floor(input.shipmentNumber ?? 1)) + Math.max(0, skip)
  return n === 1 ? String(input.orderNumber) : `${input.orderNumber}-${n}`
}
