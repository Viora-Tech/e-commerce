import type { api } from '@/lib/api-client'

/** Charges, their splits and each line's landed cost, as `costs` on an order or a shipment returns them. */
export type CostPreview = Awaited<ReturnType<typeof api.purchaseOrders.costs>>
export type PreviewCharge = CostPreview['charges'][number]
export type PreviewLine = CostPreview['lines'][number]

/** Where a new charge goes. */
export type ChargeOwner = { purchaseOrderId: string } | { inboundShipmentId: string }
