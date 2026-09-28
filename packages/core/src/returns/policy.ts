/** SOURCE OF TRUTH: returns policy, reasons, eligibility, status timeline — WHAT: the store's return rules (stored on `store.returns`), the plain-language reason list, which order lines can still go back and the steps a return moves through / WHY: the storefront form, the admin Returns pages, Settings and the emails must all agree, and client code needs it without a database import */
import { z } from 'zod'

/*
 * Pure: no database import, so the storefront and admin client components can
 * use it through `@commerce/core/returns`.
 */

// The reason list has no zod, so the storefront's return form can import it in the browser
// (`@commerce/core/return-reasons`); re-exported here so nothing else changes.
import { RETURN_REASONS, type ReturnReason } from './reasons'

export { RETURN_REASON_LABELS, RETURN_REASONS, type ReturnReason } from './reasons'

/** Reasons on by default: problems with the product, not "changed my mind". */
export const DEFAULT_RETURN_REASONS: ReturnReason[] = [
  'damaged',
  'wrong_item',
  'not_as_described',
  'quality',
  'other',
]

export const RETURN_REFUND_METHODS = ['original', 'store_credit'] as const
export type ReturnRefundMethod = (typeof RETURN_REFUND_METHODS)[number]

export const ReturnPolicySchema = z.object({
  /** Shoppers can ask for a return from their account. */
  enabled: z.boolean().default(true),
  /** Days after delivery a shopper can ask. */
  windowDays: z.number().int().min(1).max(90).default(7),
  reasons: z
    .array(z.enum(RETURN_REASONS))
    .min(1)
    .default(DEFAULT_RETURN_REASONS)
    .transform((r) => RETURN_REASONS.filter((code) => r.includes(code))),
  /** Put items back in stock as soon as they arrive in good condition. */
  restockAutomatically: z.boolean().default(true),
  /** What the admin suggests first when giving money back. */
  refundMethod: z.enum(RETURN_REFUND_METHODS).default('original'),
})
export type ReturnPolicy = z.infer<typeof ReturnPolicySchema>

export const defaultReturnPolicy: ReturnPolicy = ReturnPolicySchema.parse({})

export function parseReturnPolicy(raw: unknown): ReturnPolicy {
  const r = ReturnPolicySchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultReturnPolicy
}

/** Mirrors the `return_request.status` column. */
export const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'in_transit',
  'received',
  'resolved',
  'cancelled',
] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export const RETURN_KINDS = ['return', 'rto'] as const
export type ReturnKind = (typeof RETURN_KINDS)[number]

export const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit', 'reship', 'none'] as const
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number]

/** Returns someone still has to act on (the admin "Needs action" filter). */
export const OPEN_RETURN_STATUSES: readonly ReturnStatus[] = [
  'requested',
  'approved',
  'in_transit',
  'received',
]

/** Returns that count against an order line's returnable quantity. */
export const ACTIVE_RETURN_STATUSES: readonly ReturnStatus[] = [
  'requested',
  'approved',
  'in_transit',
  'received',
  'resolved',
]

/** A return (or RTO) whose goods are back with the merchant. */
export const RECEIVED_RETURN_STATUSES: readonly ReturnStatus[] = ['received', 'resolved']

export const returnLabel = (n: number): string => `R-${n}`

const DAY_MS = 86_400_000

export type EligibilityLine = {
  id: string
  quantity: number
  fulfilledQuantity: number
  giftCard: boolean
}

export type EligibilityInput = {
  policy: ReturnPolicy
  /** Order lifecycle status. */
  status: string
  /** When the parcel reached the shopper; null when it has not (yet). */
  deliveredAt: Date | null
  lines: readonly EligibilityLine[]
  /** Units of each order line already in a live return. */
  alreadyReturning: ReadonlyMap<string, number>
  now: Date
}

export type LineEligibility = {
  lineId: string
  /** Units the shopper can still send back. */
  returnable: number
  why: 'ok' | 'gift_card' | 'not_shipped' | 'already_returning'
}

export type Eligibility = {
  open: boolean
  why: 'ok' | 'disabled' | 'cancelled' | 'not_delivered' | 'window_closed' | 'nothing_left'
  /** Last moment a request is accepted; null before delivery. */
  closesAt: Date | null
  /** Whole days left in the window (0 on the last day). */
  daysLeft: number | null
  lines: LineEligibility[]
}

/**
 * Whether a shopper can ask for a return on this order, and how many units of
 * each line. The window counts from delivery. Gift cards never go back.
 */
export function returnEligibility(input: EligibilityInput): Eligibility {
  const lines: LineEligibility[] = input.lines.map((l) => {
    if (l.giftCard) return { lineId: l.id, returnable: 0, why: 'gift_card' }
    const shipped = Math.max(0, Math.min(l.fulfilledQuantity, l.quantity))
    if (shipped === 0) return { lineId: l.id, returnable: 0, why: 'not_shipped' }
    const left = shipped - (input.alreadyReturning.get(l.id) ?? 0)
    return left > 0
      ? { lineId: l.id, returnable: left, why: 'ok' }
      : { lineId: l.id, returnable: 0, why: 'already_returning' }
  })
  const closesAt = input.deliveredAt
    ? new Date(input.deliveredAt.getTime() + input.policy.windowDays * DAY_MS)
    : null
  const daysLeft = closesAt
    ? Math.max(0, Math.floor((closesAt.getTime() - input.now.getTime()) / DAY_MS))
    : null
  const closed = (why: Eligibility['why']): Eligibility => ({
    open: false,
    why,
    closesAt,
    daysLeft,
    lines,
  })
  if (!input.policy.enabled) return closed('disabled')
  if (input.status === 'cancelled' || input.status === 'draft') return closed('cancelled')
  if (!input.deliveredAt || !closesAt) return closed('not_delivered')
  if (input.now.getTime() > closesAt.getTime()) return closed('window_closed')
  if (!lines.some((l) => l.returnable > 0)) return closed('nothing_left')
  return { open: true, why: 'ok', closesAt, daysLeft, lines }
}

export type ReturnTimes = {
  status: ReturnStatus
  kind: ReturnKind
  pickupMethod: 'courier' | 'customer' | null
  requestedAt: Date
  approvedAt: Date | null
  rejectedAt: Date | null
  pickupArrangedAt: Date | null
  receivedAt: Date | null
  resolvedAt: Date | null
}

export type TimelineStepKey =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_transit'
  | 'received'
  | 'resolved'
  | 'cancelled'

export type TimelineStep = { key: TimelineStepKey; at: Date | null; done: boolean }

/**
 * The steps a return goes through, done or still ahead, for the shopper's and
 * the merchant's timeline. A rejected or cancelled return stops there. An RTO
 * starts at "received": the courier brought it back.
 */
export function returnTimeline(r: ReturnTimes): TimelineStep[] {
  if (r.kind === 'rto') {
    return [
      { key: 'received', at: r.receivedAt ?? r.requestedAt, done: true },
      { key: 'resolved', at: r.resolvedAt, done: r.status === 'resolved' },
    ]
  }
  const requested: TimelineStep = { key: 'requested', at: r.requestedAt, done: true }
  if (r.status === 'rejected') {
    return [requested, { key: 'rejected', at: r.rejectedAt, done: true }]
  }
  if (r.status === 'cancelled') {
    return [requested, { key: 'cancelled', at: r.resolvedAt, done: true }]
  }
  return [
    requested,
    { key: 'approved', at: r.approvedAt, done: r.approvedAt !== null },
    { key: 'in_transit', at: r.pickupArrangedAt, done: r.pickupArrangedAt !== null },
    { key: 'received', at: r.receivedAt, done: r.receivedAt !== null },
    { key: 'resolved', at: r.resolvedAt, done: r.status === 'resolved' },
  ]
}

/** What the merchant may do next, so the admin shows only buttons that work. */
export function returnActions(r: {
  status: ReturnStatus
  kind: ReturnKind
  restockedAt: Date | string | null
  resolution?: ReturnResolution | null | undefined
}) {
  const received = RECEIVED_RETURN_STATUSES.includes(r.status)
  return {
    approve: r.kind === 'return' && r.status === 'requested',
    reject: r.kind === 'return' && (r.status === 'requested' || r.status === 'approved'),
    arrangePickup: r.kind === 'return' && r.status === 'approved',
    receive: r.kind === 'return' && (r.status === 'approved' || r.status === 'in_transit'),
    resolve: r.status === 'received',
    restock: received && r.restockedAt === null && r.resolution !== 'reship',
  }
}

/** The value of what goes back, before any discount: the default refund suggestion. */
export function returnedValuePaise(
  lines: readonly { quantity: number; unitPricePaise: number }[],
): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
}
