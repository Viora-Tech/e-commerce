/**
 * How RapidShyp books a shipment (`createShipment`) and sends a pending order (`pushOrder`).
 *
 * WRAPPER OR CREATE_ORDER: the plain Create Order API's own response is documented only as
 * `{ status, remarks, order_id, shipment: [] }` with no field-level detail inside `shipment`
 * ("structure not detailed"). The Wrapper API takes the same order fields and chains create +
 * assign AWB + generate label + schedule pickup server-side, and its response sample is fully
 * specified (`awbGenerated`, `awb`, `labelURL`, `pickupScheduled`, `shipmentId`, `orderId`, ...)
 * - but it assigns the courier by the account's courier priority, and once a shipment has an
 * AWB, `assign_awb` refuses to switch it ("Awb can not assign with this shipment id", seen
 * 14 Nov 2026: Blue Dart Air picked, Amazon Shipping booked, nothing recorded here). So:
 *  - no courier picked: the wrapper, as before;
 *  - a courier picked in the rate table: `create_order` (no courier), then `assign_awb` with
 *    that courier's code, then pickup and label. The shipment id is read tolerantly from the
 *    create answer (`shipment[0]`, one object, or top level; `shipmentId` or `shipment_id`);
 *    the documented answer has `shipment: []`, and Track Order says "not found" until an AWB
 *    exists, so with no id the order is left on RapidShyp for the merchant to assign the courier
 *    there (owner, 14 Nov 2026), and staff are told so.
 *    If the courier is refused, the order just created is cancelled so nothing is left behind;
 *  - an order pushed earlier as pending: `assign_awb` on its shipment; refused, it stays as it
 *    was (it was there before this booking).
 *
 * ORDER IDS: orders go to RapidShyp under our order number (`2471`), with a suffix for the
 * order's later bookings (`2471-2`; `courierOrderRef`), so merchants find them by number on
 * RapidShyp's panel. "Order ... already exists" moves to the next suffix. `providerRef` (what
 * `cancel_order` takes) is RapidShyp's echo of the id, else the id we sent. Known refusal
 * remarks are put in the merchant's words (`./remarks`), RapidShyp's own in brackets after them.
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  courierOrderRef,
  type PushOrderResult,
} from '@commerce/shipping'
import type { RapidshypConfig } from './rapidshyp'
import {
  AWB_TAKEN,
  explainRapidshypRemark,
  isDuplicateOrderRemark,
  rapidshypRefusal,
} from './remarks'

/** The adapter's own calls this flow is built from (auth, base URL and error mapping included). */
export type BookingCalls = {
  provider: string
  config: Pick<RapidshypConfig, 'storeName' | 'pickupAddressName'>
  post: <T>(path: string, body: unknown) => Promise<T>
  assignAwb: (shipmentId: string, courierCode?: string) => Promise<{ awb: string }>
  /**
   * The order's shipment id from Track Order by order id (create_order's answer has none), and
   * what Track Order said, for the staff message when it is not there.
   */
  findShipmentId: (
    orderRef: string,
    contact: { phone: string; email?: string | undefined },
  ) => Promise<{ id: string | undefined; said: string }>
  /** Waits between lookups; tests pass one that does not. */
  wait?: (ms: number) => Promise<void>
  cancel: (orderId: string) => Promise<void>
  schedulePickup: (shipmentId: string, awb: string) => Promise<unknown>
  generateLabel: (shipmentIds: string[]) => Promise<string | undefined>
}

type WrapperShipment = {
  shipmentId?: string | number
  awbGenerated?: boolean
  labelGenerated?: boolean
  pickupScheduled?: boolean
  awb?: string
  courierCode?: string
  courierName?: string
  labelURL?: string
  manifestURL?: string
}

type WrapperResponse = {
  status?: string
  remarks?: string
  orderId?: string
  orderCreated?: boolean
  shipment?: WrapperShipment[]
}

type CreatedShipment = { shipmentId?: string | number; shipment_id?: string | number }

type CreateOrderOnlyResponse = CreatedShipment & {
  status?: string
  remarks?: string
  order_id?: string | number
  /** Documented as a list with no field detail; read tolerantly (one object, or ids on top). */
  shipment?: CreatedShipment[] | CreatedShipment
}

const CREATE_ORDER = '/rapidshyp/apis/v1/create_order'
const WRAPPER = '/rapidshyp/apis/v1/wrapper'

/** How many order ids (`2471`, `2471-2`, ...) to try when RapidShyp says one is taken. */
const MAX_ORDER_REF_TRIES = 4

/** The shipment id out of a Create Order answer, wherever it sits. */
function createdShipmentId(r: CreateOrderOnlyResponse): string | undefined {
  const list = Array.isArray(r.shipment) ? r.shipment : r.shipment ? [r.shipment] : []
  const id = list[0]?.shipmentId ?? list[0]?.shipment_id ?? r.shipmentId ?? r.shipment_id
  return id != null && String(id) !== '' ? String(id) : undefined
}

/** Seconds between Track Order lookups for a new order's shipment id: it can take a moment. */
// Track Order answers "not found" until an AWB exists (seen 14 Nov 2026), so one quick ask.
const SHIPMENT_LOOKUP_WAITS_MS = [0]

/** The shipment id of an order just created: from its answer, else from Track Order. */
async function shipmentIdOf(
  calls: BookingCalls,
  input: CreateShipmentInput,
  result: CreateOrderOnlyResponse,
  orderRef: string,
): Promise<{ id: string | undefined; said: string }> {
  const direct = createdShipmentId(result)
  if (direct) return { id: direct, said: '' }
  const wait = calls.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let said = 'not asked'
  for (const ms of SHIPMENT_LOOKUP_WAITS_MS) {
    if (ms > 0) await wait(ms)
    const found = await calls
      .findShipmentId(orderRef, { phone: input.to.phone, email: input.to.email })
      .catch((error: unknown) => ({
        id: undefined,
        said: `failed: ${error instanceof Error ? error.message : String(error)}`,
      }))
    if (found.id) return found
    said = found.said
  }
  return { id: undefined, said }
}

/** What create_order answered, short, for a staff message: its remark and the fields it had. */
const createAnswer = (r: CreateOrderOnlyResponse) =>
  `"${r.remarks ?? r.status ?? ''}", fields ${Object.keys(r).join(', ') || 'none'}, shipment ${JSON.stringify(r.shipment ?? null).slice(0, 80)}`

/** The picked courier as the merchant saw it, for messages. */
const courierName = (input: CreateShipmentInput) =>
  input.serviceLabel?.trim() || (input.serviceId ? `courier ${input.serviceId}` : 'a courier')

/** RapidShyp refused the order itself: its remark, in the merchant's words when known. */
const orderRefused = (provider: string, fallback: string, remarks: string | undefined) =>
  new CourierError('rejected', provider, rapidshypRefusal(fallback, remarks), {
    reason: remarks?.trim() || undefined,
  })

/** The order as RapidShyp takes it, filed under `orderRef`: the order number. */
function buildOrderPayload(
  config: BookingCalls['config'],
  input: CreateShipmentInput,
  orderRef = courierOrderRef(input),
) {
  return {
    orderId: orderRef,
    orderDate: new Date().toISOString().slice(0, 10),
    storeName: config.storeName,
    billingIsShipping: true,
    pickupAddressName: config.pickupAddressName,
    shippingAddress: {
      firstName: input.to.name,
      addressLine1: input.to.line1,
      addressLine2: input.to.line2 ?? '',
      pinCode: input.to.pincode,
      phone: input.to.phone,
    },
    orderItems: input.lines.map((l) => ({
      itemName: l.title.slice(0, 250),
      units: l.quantity,
      unitPrice: Math.round(l.unitPricePaise) / 100,
      tax: 0,
    })),
    paymentMethod: input.paymentMode === 'cod' ? 'COD' : 'PREPAID',
    packageDetails: {
      packageLength: 10,
      packageBreadth: 10,
      packageHeight: 10,
      packageWeight: Math.max(input.weightGrams, 1),
    },
  }
}

/**
 * Send a new order (`create_order` or `wrapper`) under the order number. When RapidShyp says
 * that id is taken (a rebook after a cancel, an order made on its panel), the next one is
 * tried: `2471`, then `2471-2`, up to `MAX_ORDER_REF_TRIES` ids.
 */
async function sendOrder<T extends { status?: string; remarks?: string; orderCreated?: boolean }>(
  calls: BookingCalls,
  input: CreateShipmentInput,
  path: string,
): Promise<{ ref: string; result: T }> {
  for (let skip = 0; ; skip += 1) {
    const ref = courierOrderRef(input, skip)
    const last = skip >= MAX_ORDER_REF_TRIES - 1
    try {
      const result = await calls.post<T>(path, buildOrderPayload(calls.config, input, ref))
      const created =
        result.orderCreated === true || String(result.status ?? '').toUpperCase() === 'SUCCESS'
      if (!last && !created && isDuplicateOrderRemark(result.remarks)) continue
      return { ref, result }
    } catch (error) {
      if (!last && error instanceof CourierError && isDuplicateOrderRemark(error.reason)) continue
      throw error
    }
  }
}

/**
 * Create Order only: the order shows in RapidShyp's panel without an AWB. The shipment id is
 * read when present; `externalOrderId` is RapidShyp's echo of the id, else the one we sent.
 */
export async function pushRapidshypOrder(
  calls: BookingCalls,
  input: CreateShipmentInput,
): Promise<PushOrderResult> {
  const { ref, result } = await sendOrder<CreateOrderOnlyResponse>(calls, input, CREATE_ORDER)
  if (!result.order_id && !createdShipmentId(result)) {
    throw orderRefused(calls.provider, 'RapidShyp rejected the order', result.remarks)
  }
  const externalOrderId = result.order_id ? String(result.order_id) : ref
  // Without it a later booking would make a second order on RapidShyp: look it up now.
  return {
    externalOrderId,
    externalShipmentId: (await shipmentIdOf(calls, input, result, externalOrderId)).id,
  }
}

/** Book: a pending order, the merchant's courier, or the account's priority (see above). */
export async function bookRapidshypShipment(
  calls: BookingCalls,
  input: CreateShipmentInput,
): Promise<CreateShipmentResult> {
  const pushedShipment = input.pushed?.externalShipmentId
  if (pushedShipment) return bookPushed(calls, input, pushedShipment)
  if (input.serviceId) return bookChosen(calls, input, input.serviceId)
  return bookByPriority(calls, input)
}

/** A pending order already on RapidShyp: assign the courier to its shipment. */
async function bookPushed(
  calls: BookingCalls,
  input: CreateShipmentInput,
  shipmentId: string,
): Promise<CreateShipmentResult> {
  let awb: string
  try {
    awb = (await calls.assignAwb(shipmentId, input.serviceId)).awb
  } catch (error) {
    // The pending order was there before this booking; it stays on RapidShyp as it was.
    throw courierRefused(calls, input, error, 'The order is still on RapidShyp, not booked.')
  }
  return finishBooking(calls, shipmentId, awb, {
    orderRef: input.pushed?.externalOrderId || courierOrderRef(input),
  })
}

/** The merchant's courier: create the order with no courier, then assign that one. */
async function bookChosen(
  calls: BookingCalls,
  input: CreateShipmentInput,
  courierCode: string,
): Promise<CreateShipmentResult> {
  const { ref, result } = await sendOrder<CreateOrderOnlyResponse>(calls, input, CREATE_ORDER)
  if (!result.order_id && !createdShipmentId(result)) {
    throw orderRefused(calls.provider, 'RapidShyp rejected the order', result.remarks)
  }
  // cancel_order takes the id RapidShyp echoes back, which is the one we sent for "DEFAULT".
  const orderRef = result.order_id ? String(result.order_id) : ref
  const lookup = await shipmentIdOf(calls, input, result, orderRef)
  const shipmentId = lookup.id
  if (!shipmentId) {
    // RapidShyp's API gives no way to put a courier on a new order (create_order returns
    // `shipment: []`): the order stays there for the merchant to assign the courier in RapidShyp
    // (owner, 14 Nov 2026), instead of being cancelled.
    throw new CourierError(
      'rejected',
      calls.provider,
      `Order ${orderRef} is now on RapidShyp without a courier: RapidShyp does not let us assign ${courierName(input)} to a new order. Open order ${orderRef} in RapidShyp and assign ${courierName(input)} there, then add its AWB here with Ship › Shipped yourself.`,
      { reason: `create_order: ${createAnswer(result)}; track_order: ${lookup.said}` },
    )
  }
  let awb: string
  try {
    awb = (await calls.assignAwb(shipmentId, courierCode)).awb
  } catch (error) {
    // Nothing is left behind: the order made a moment ago goes, so a rebook starts clean.
    throw courierRefused(calls, input, error, await takeBack(calls, orderRef))
  }
  return finishBooking(calls, shipmentId, awb, { orderRef })
}

/** No courier picked: the wrapper books by the account's courier priority, in one call. */
async function bookByPriority(
  calls: BookingCalls,
  input: CreateShipmentInput,
): Promise<CreateShipmentResult> {
  const { ref, result: order } = await sendOrder<WrapperResponse>(calls, input, WRAPPER)
  if (!order.orderCreated) {
    throw orderRefused(calls.provider, 'RapidShyp rejected the order', order.remarks)
  }
  const first = order.shipment?.[0]
  const shipmentId = first?.shipmentId != null ? String(first.shipmentId) : undefined
  if (!shipmentId) {
    throw new CourierError(
      'bad_response',
      calls.provider,
      'RapidShyp created the order but returned no shipment id.',
    )
  }
  // The wrapper's own AWB step came back empty (no courier matched its priority): one retry,
  // letting RapidShyp pick its default courier again.
  const awb = first?.awb || (await calls.assignAwb(shipmentId).catch(() => null))?.awb
  if (!awb) {
    throw orderRefused(
      calls.provider,
      `RapidShyp created shipment ${shipmentId} but could not assign a courier`,
      order.remarks,
    )
  }
  return finishBooking(calls, shipmentId, awb, {
    orderRef: order.orderId || ref,
    labelUrl: first?.labelURL,
    pickupScheduled: first?.pickupScheduled === true,
  })
}

/** Pickup and label for a booked shipment, each best-effort: neither undoes the booking. */
async function finishBooking(
  calls: BookingCalls,
  shipmentId: string,
  awb: string,
  done: { orderRef: string; labelUrl?: string | undefined; pickupScheduled?: boolean },
): Promise<CreateShipmentResult> {
  if (!done.pickupScheduled) {
    // The merchant can retry a failed pickup from the Shipments workspace's pickup tab.
    await calls.schedulePickup(shipmentId, awb).catch(() => undefined)
  }
  const labelUrl = done.labelUrl || (await calls.generateLabel([shipmentId]).catch(() => undefined))
  // cancel_order takes this order id: the one sent (`2471`), or RapidShyp's echo of it.
  return { waybill: awb, providerRef: done.orderRef, labelUrl }
}

/** Cancel an order this booking just made, and say for the merchant how that went. */
async function takeBack(calls: BookingCalls, orderRef: string): Promise<string> {
  try {
    await calls.cancel(orderRef)
    return `We cancelled order ${orderRef} on RapidShyp, so nothing is left there.`
  } catch {
    return `Order ${orderRef} is still on RapidShyp: cancel it there before booking again.`
  }
}

/**
 * RapidShyp would not put the picked courier on the shipment: a refusal naming the courier and
 * RapidShyp's reason. A call that got no answer (timeout, outage, auth) keeps its own kind.
 */
function courierRefused(
  calls: BookingCalls,
  input: CreateShipmentInput,
  error: unknown,
  note: string,
): unknown {
  if (!(error instanceof CourierError)) return error
  if (error.kind !== 'rejected' && error.reason === undefined) return error
  const remark = error.reason?.trim() || 'no detail returned'
  // "Awb can not assign" on a fresh shipment means this courier said no, not that one is set.
  const known = AWB_TAKEN.test(remark) ? null : explainRapidshypRemark(remark)
  const advice = known ?? 'Pick another courier and book again.'
  return new CourierError(
    'rejected',
    calls.provider,
    `RapidShyp would not book ${courierName(input)}. ${note} ${advice} (${remark})`,
    { status: error.status, reason: error.reason, cause: error },
  )
}
