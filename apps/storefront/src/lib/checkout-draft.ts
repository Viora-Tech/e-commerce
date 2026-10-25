import type { CheckoutFormState } from '@/lib/checkout-form-state'

/*
 * What a reload keeps of the stepped checkout: the typed details and the picks, for this
 * cart, in this browser tab only (sessionStorage, gone when the tab closes). The step itself
 * lives in the URL (`lib/checkout-steps.ts`); this is what lets `?step=payment` survive a
 * reload. Gift cards are not kept: their balance is re-checked when they are applied.
 */

export type CheckoutDraft = {
  form: CheckoutFormState
  /** The saved address picked, or the "new address" choice. */
  savedId: string
  /** The GSTIN box was ticked. */
  business: boolean
  /** The shipping rate picked; kept only while the new quote still offers it. */
  rateId: string | null
  /** The shopper chose to check out as a guest rather than sign in with a code. */
  guest: boolean
}

const KEY = 'checkout-draft'

/** Longest value any checkout field accepts; anything longer is not ours. */
const MAX_FIELD = 2_000

const FORM_KEYS = [
  'name',
  'email',
  'phone',
  'line1',
  'line2',
  'city',
  'stateCode',
  'pincode',
  'payment',
  'gstin',
  'businessName',
  'note',
  'label',
] as const satisfies readonly (keyof CheckoutFormState)[]

const isField = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_FIELD

/** The draft saved for this cart, or null for another cart's draft or anything malformed. */
export function parseDraft(raw: string | null, cartId: string): CheckoutDraft | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (d.cartId !== cartId || typeof d.form !== 'object' || d.form === null) return null
  const f = d.form as Record<string, unknown>
  if (!FORM_KEYS.every((k) => isField(f[k]))) return null
  if (!isField(d.savedId) || typeof d.business !== 'boolean') return null
  if (d.rateId !== null && !isField(d.rateId)) return null
  const form = Object.fromEntries(FORM_KEYS.map((k) => [k, f[k]])) as CheckoutFormState
  return {
    form,
    savedId: d.savedId,
    business: d.business,
    rateId: d.rateId,
    guest: d.guest === true,
  }
}

export const serialiseDraft = (cartId: string, draft: CheckoutDraft): string =>
  JSON.stringify({ cartId, ...draft })

/** Private windows and blocked storage throw; the checkout then simply starts fresh. */
export function readDraft(cartId: string): CheckoutDraft | null {
  try {
    return parseDraft(window.sessionStorage.getItem(KEY), cartId)
  } catch {
    return null
  }
}

export function writeDraft(cartId: string, draft: CheckoutDraft): void {
  try {
    window.sessionStorage.setItem(KEY, serialiseDraft(cartId, draft))
  } catch {
    // Storage full or blocked: the step still works, a reload starts from the account's details.
  }
}
