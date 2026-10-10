/**
 * The Shipments workspace's tabs (Orders → Shipments, Figma "Orders / Shipments"): which
 * shipment statuses each tab lists. "To book" is orders, not shipments, so it has none.
 * Shared by the API's list and counts and the admin's tabs, so the two never disagree.
 */
export const SHIPMENT_TABS = ['toBook', 'booked', 'inTransit', 'delivered', 'rto'] as const

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
  inTransit: ['picked_up', 'in_transit', 'out_for_delivery'],
  delivered: ['delivered'],
  rto: ['rto'],
}
