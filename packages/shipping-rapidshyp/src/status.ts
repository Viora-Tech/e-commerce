import type { ShipmentStatus } from '@commerce/shipping'

/**
 * RapidShyp's own tracking status codes (docs' "Tracking status code
 * Rapidshyp" table), reduced to ours. Falls back to the shipment's coarse
 * free-text `shipment_status` (e.g. "READY_TO_SHIP") when no code is present,
 * and to `in_transit` for anything unrecognised rather than guessing a
 * terminal state.
 */
export function mapRapidshypStatus(
  code: string | null | undefined,
  shipmentStatus: string | null | undefined,
): ShipmentStatus {
  const c = (code ?? '').toUpperCase()
  if (c === 'DEL') return 'delivered'
  if (c.startsWith('RTO')) return 'rto'
  if (c === 'CAN') return 'cancelled'
  if (c === 'OFD') return 'out_for_delivery'
  if (c === 'PUC') return 'picked_up'
  if (['SCB', 'PSH', 'OFP', 'PUE', 'PCN'].includes(c)) return 'created'
  if (['SPD', 'INT', 'RAD', 'DED', 'UND', 'ONH', 'LST', 'DMG', 'MSR', 'DPO'].includes(c)) {
    return 'in_transit'
  }
  const s = (shipmentStatus ?? '').toUpperCase()
  // "UNDELIVERED" and "NOT DELIVERED" contain "DELIVERED"; they are attempts, not delivery.
  if (/UNDELIVERED|NOT[\s_]DELIVERED/.test(s)) return 'in_transit'
  if (s.includes('DELIVERED')) return 'delivered'
  if (s.includes('RTO')) return 'rto'
  if (s.includes('CANCEL')) return 'cancelled'
  if (s.includes('READY_TO_SHIP') || s.includes('ASSIGNED') || s.includes('MANIFEST')) {
    return 'created'
  }
  return 'in_transit'
}
