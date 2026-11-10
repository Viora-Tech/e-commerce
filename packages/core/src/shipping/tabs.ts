/** SOURCE OF TRUTH: Shipments workspace tabs — WHAT: the Shipments workspace's tabs (Orders → Shipments, Figma "Orders / Shipments"): which
 * shipment statuses each tab lists. "To book" is orders, not shipments, so it has none.
 * Shared by the API's list and counts and the admin's tabs, so the two never disagree.
 */
export const SHIPMENT_TABS = [
  'toBook',
  'booked',
  'toPickUp',
  'inTransit',
  'delivered',
  'rto',
] as const

export type ShipmentTab = (typeof SHIPMENT_TABS)[number]

export type ShipmentStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto'
  | 'cancelled'

export const SHIPMENT_TAB_STATUSES: Record<Exclude<ShipmentTab, 'toBook'>, ShipmentStatus[]> = {
  booked: ['created'],
  toPickUp: ['created'],
  inTransit: ['picked_up', 'in_transit', 'out_for_delivery'],
  delivered: ['delivered'],
  rto: ['rto'],
}

/**
 * Booked and To be picked up both hold `created` labels (owner, 10 Nov 2026): Booked is a label
 * with no pickup yet, To be picked up one on a pickup request (and its manifest) for a day.
 */
export const SHIPMENT_TAB_ON_PICKUP: Partial<Record<ShipmentTab, boolean>> = {
  booked: false,
  toPickUp: true,
}
