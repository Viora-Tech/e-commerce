/**
 * Pure stock arithmetic shared by the inventory services and the admin UI.
 * No database access here, so client components may import it.
 */

export type StockLevel = { onHand: number; reserved: number; incoming: number }

/** What can still be sold: physically present minus what open orders hold. */
export function availableOf(level: Pick<StockLevel, 'onHand' | 'reserved'>): number {
  return level.onHand - level.reserved
}

export class NegativeStockError extends Error {
  readonly code = 'NEGATIVE_STOCK'
  constructor(
    readonly current: number,
    readonly delta: number,
  ) {
    super(`Stock cannot go below zero (${current} ${delta < 0 ? '-' : '+'} ${Math.abs(delta)})`)
    this.name = 'NegativeStockError'
  }
}

/**
 * The on-hand count after applying a delta. Tracked variants may never go below
 * zero; a variant that does not track inventory (sells regardless of stock) may.
 */
export function nextOnHand(current: number, delta: number, allowNegative: boolean): number {
  const next = current + delta
  if (next < 0 && !allowNegative) throw new NegativeStockError(current, delta)
  return next
}

/** Delta that turns `current` into `target`, for "Set to" edits. */
export function deltaToReach(current: number, target: number): number {
  return target - current
}

export type PurchaseOrderLineStock = { quantity: number; received: number; unitCostPaise: number }

/** The single source of truth for a purchase order's status — import this everywhere. */
export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'closed',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

/** Units still to arrive on a line. */
export function remainingOf(line: Pick<PurchaseOrderLineStock, 'quantity' | 'received'>): number {
  return Math.max(0, line.quantity - line.received)
}

/** Clamp a receipt to what is outstanding; negative or oversized receipts are cut to fit. */
export function clampReceipt(
  line: Pick<PurchaseOrderLineStock, 'quantity' | 'received'>,
  quantity: number,
): number {
  return Math.max(0, Math.min(Math.trunc(quantity), remainingOf(line)))
}

/**
 * Status implied by the receipts so far. Draft and closed are set explicitly;
 * once ordered, the lines decide between ordered, partially received and received.
 */
export function purchaseOrderStatus(
  lines: readonly Pick<PurchaseOrderLineStock, 'quantity' | 'received'>[],
  current: PurchaseOrderStatus,
): PurchaseOrderStatus {
  if (current === 'draft' || current === 'closed') return current
  const received = lines.reduce((n, l) => n + Math.min(l.received, l.quantity), 0)
  const ordered = lines.reduce((n, l) => n + l.quantity, 0)
  if (ordered > 0 && received >= ordered) return 'received'
  if (received > 0) return 'partially_received'
  return 'ordered'
}

export type PurchaseOrderTotals = {
  units: number
  receivedUnits: number
  subtotalPaise: number
  totalPaise: number
}

export function purchaseOrderTotals(
  lines: readonly PurchaseOrderLineStock[],
  shippingPaise: number,
  taxPaise: number,
): PurchaseOrderTotals {
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const receivedUnits = lines.reduce((n, l) => n + Math.min(l.received, l.quantity), 0)
  const subtotalPaise = lines.reduce((n, l) => n + l.quantity * l.unitCostPaise, 0)
  return {
    units,
    receivedUnits,
    subtotalPaise,
    totalPaise: subtotalPaise + shippingPaise + taxPaise,
  }
}

export type StockState = 'in' | 'low' | 'out'

/** In, low (at or under the store threshold) or out, by available count. */
export function stockState(available: number, lowThreshold: number): StockState {
  if (available <= 0) return 'out'
  if (available <= lowThreshold) return 'low'
  return 'in'
}
