import type { PaymentModeId } from '@/data/payment-modes'

/** Which key sets a gateway has saved. */
export type ModeKeys = Record<PaymentModeId, boolean>

/** One key set's state on the Live/Test control: checkout runs on it, it waits, or it is missing. */
export type KeySetStatus = 'in-use' | 'saved' | 'missing'

/** What a click on Live or Test does: nothing, refuse (keys missing), or ask first. */
export type SwitchDecision =
  | { kind: 'same' }
  | { kind: 'blocked'; missing: PaymentModeId }
  | { kind: 'confirm'; to: PaymentModeId }

/** Live first, the way Stripe and Razorpay dashboards show it. */
export const MODE_ORDER: readonly PaymentModeId[] = ['live', 'test']

export function keySetStatus(
  mode: PaymentModeId,
  active: PaymentModeId | null,
  keys: ModeKeys,
): KeySetStatus {
  if (!keys[mode]) return 'missing'
  return active === mode ? 'in-use' : 'saved'
}

/**
 * The Live/Test switch's rule: switching to a mode with no saved keys is refused with a
 * reason (never a silent no-op), anything else asks first. Keys are never touched here.
 */
export function decideSwitch(
  active: PaymentModeId | null,
  to: PaymentModeId,
  keys: ModeKeys,
): SwitchDecision {
  if (active === to) return { kind: 'same' }
  if (!keys[to]) return { kind: 'blocked', missing: to }
  return { kind: 'confirm', to }
}
