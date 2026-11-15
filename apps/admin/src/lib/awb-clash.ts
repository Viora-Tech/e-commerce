import { ORPCError } from '@orpc/client'

/** The order that already has the tracking number typed, from `orders.fulfil`'s CONFLICT. */
export type AwbClash = { waybill: string; orderId: string; orderNumber: number; live: boolean }

/** The clash a packing call was refused with, or null for any other error. */
export function awbClash(err: unknown): AwbClash | null {
  if (!(err instanceof ORPCError) || err.data?.reason !== 'awb_on_another_order') return null
  const d = err.data as Partial<AwbClash>
  if (typeof d.waybill !== 'string' || typeof d.orderNumber !== 'number') return null
  return {
    waybill: d.waybill,
    orderId: String(d.orderId ?? ''),
    orderNumber: d.orderNumber,
    live: d.live === true,
  }
}
