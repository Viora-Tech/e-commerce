import type { CheckoutFormState } from '@/lib/checkout-form-state'

/*
 * A guest's contact and delivery details, remembered in this browser (localStorage) so the
 * next checkout on the same device starts filled in, as Shopify's does. The tab draft
 * (`checkout-draft.ts`) only lives for one cart in one tab; this outlives both. Signed-in
 * shoppers never use it: their account prefills the form. Only the fields below are kept,
 * never payment, GSTIN, notes or gift cards, and the entry is dropped after 90 days.
 */

export const REMEMBERED_FIELDS = [
  'name',
  'email',
  'phone',
  'line1',
  'line2',
  'city',
  'stateCode',
  'pincode',
] as const satisfies readonly (keyof CheckoutFormState)[]

/** Kept beside the fields: the address's country, absent on entries saved before the picker. */
export type RememberedDetails = Pick<CheckoutFormState, (typeof REMEMBERED_FIELDS)[number]> & {
  countryCode?: string | undefined
}

const KEY = 'checkout-remembered'

/** How long the details are kept after the last checkout that saved them. */
export const REMEMBER_MS = 90 * 24 * 60 * 60 * 1000

/** Longest value any checkout field accepts; anything longer is not ours. */
const MAX_FIELD = 2_000

const isField = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_FIELD

/** The details saved in this browser, or null when none, expired or malformed. */
export function parseRemembered(raw: string | null, now: number): RememberedDetails | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.savedAt !== 'number' || now - d.savedAt > REMEMBER_MS) return null
  if (!REMEMBERED_FIELDS.every((k) => isField(d[k]))) return null
  const kept = Object.fromEntries(REMEMBERED_FIELDS.map((k) => [k, d[k]])) as RememberedDetails
  const country = typeof d.countryCode === 'string' && /^[A-Z]{2}$/.test(d.countryCode)
  return { ...kept, countryCode: country ? (d.countryCode as string) : 'IN' }
}

/** Worth keeping once the shopper has typed a way to reach them. */
export const hasContact = (form: RememberedDetails): boolean =>
  Boolean(form.email.trim() || form.phone.trim())

export const serialiseRemembered = (form: RememberedDetails, now: number): string =>
  JSON.stringify({
    ...Object.fromEntries(REMEMBERED_FIELDS.map((k) => [k, form[k]])),
    countryCode: form.countryCode ?? 'IN',
    savedAt: now,
  })

/** Private windows and blocked storage throw; the checkout then starts empty. */
export function readRemembered(): RememberedDetails | null {
  try {
    return parseRemembered(window.localStorage.getItem(KEY), Date.now())
  } catch {
    return null
  }
}

export function writeRemembered(form: RememberedDetails): void {
  if (!hasContact(form)) return
  try {
    window.localStorage.setItem(KEY, serialiseRemembered(form, Date.now()))
  } catch {
    // Storage full or blocked: the next checkout simply starts empty.
  }
}
