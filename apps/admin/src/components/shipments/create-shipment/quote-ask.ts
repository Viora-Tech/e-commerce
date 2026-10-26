import { type PackageForm, parsePackage, quoteRequest, type ShipmentDraft } from './flow-state'

/**
 * When the Create shipment page may ask the couriers for prices, and with what. Pure, so the
 * tests cover it: the page asks only for a complete, valid package, only once the merchant
 * stops typing, and never twice for the same parcel.
 */

export type QuoteRequest = ReturnType<typeof quoteRequest>

export type QuoteAsk =
  /** No usable weight (or COD amount) yet: nothing to ask. */
  | { state: 'needs_package' }
  /** Some of length, width and height typed, not all: wait for the rest. */
  | { state: 'incomplete' }
  /** Ready: `key` is the request as text, equal for equal values ("150" and "150.0"). */
  | { state: 'ready'; key: string; request: QuoteRequest }

const typed = (s: string) => s.trim() !== ''

/** What the couriers would be asked for this form, or why not yet. */
export function quoteAsk(
  draft: ShipmentDraft,
  parcelId: string | null,
  form: PackageForm,
): QuoteAsk {
  const order = draft.orders[0]
  const parcel = order?.parcels.find((p) => p.id === parcelId) ?? order?.parcels[0]
  const parsed = parsePackage(form)
  if (!order || !parcel || !parsed) return { state: 'needs_package' }
  const sizes = [form.length, form.width, form.height]
  // A box size is optional, but half of one is a typo in progress, not "no box".
  if (sizes.some(typed) && !parsed.dimensionsCm) return { state: 'incomplete' }
  const request = quoteRequest(order, parcel, form, parsed)
  return { state: 'ready', key: JSON.stringify(request), request }
}

/**
 * Run `ask` once `delayMs` passes without `signal` aborting; resolves null when it aborts first
 * or while the answer is on its way (a newer package replaced this one), so a stale answer is
 * never applied. Errors of a live ask still reject.
 */
export function debouncedAsk<T>(
  ask: (signal: AbortSignal) => Promise<T>,
  delayMs: number,
  signal: AbortSignal,
): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    if (signal.aborted) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => {
      ask(signal).then(
        (answer) => resolve(signal.aborted ? null : answer),
        (err) => (signal.aborted ? resolve(null) : reject(err)),
      )
    }, delayMs)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { once: true },
    )
  })
}
