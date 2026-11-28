'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { canApply, type EditForm, formParcel, formToEdit } from './bulk-edit-state'
import { type BulkLine, missingPackage, type OrderEdit, orderQuoteRequest } from './bulk-ship-state'
import type { ParcelQuote } from './flow-state'
import { debouncedAsk } from './quote-ask'

/** Wait this long after the last keystroke, as the single-order page does (`useShipQuote`). */
const QUOTE_DEBOUNCE_MS = 600

const typed = (s: string) => s.trim() !== ''

/**
 * What the row editor (Figma 913:9698) would ask the couriers for its picked items and typed
 * package, or why not yet. Pure. `key` is the request as text; `same` when the form still prices what the row
 * already shows (nothing to ask).
 */
export function bulkEditAsk(
  line: BulkLine,
  form: EditForm,
  edit: OrderEdit | undefined,
): { state: 'same' } | { state: 'wait' } | { state: 'ready'; key: string; edit: OrderEdit } {
  const parcel = line.parcel
  const picked = formParcel(line, form)
  // Nothing ticked: nothing to price, and Apply waits for a tick (or Skip this order).
  if (!parcel || !picked || !canApply(form)) return { state: 'same' }
  // Half a box size typed is a typo in progress, not "no box" (as on the single-order page).
  const sizes = [form.length, form.width, form.height]
  if (sizes.some(typed) && !sizes.every(typed)) return { state: 'wait' }
  const next = formToEdit(form, line, edit)
  // No weight yet (a product without one): nothing to price, the row says so already.
  if (missingPackage(picked, next)) return { state: 'same' }
  const key = JSON.stringify(orderQuoteRequest(line.order, picked, next))
  const current = JSON.stringify(orderQuoteRequest(line.order, parcel, edit))
  return key === current ? { state: 'same' } : { state: 'ready', key, edit: next }
}

/**
 * Live prices for the row editor: like the single-order Create shipment page, a changed weight,
 * box size or payment asks that order's couriers again 600 ms after the last edit, and a newer
 * edit cancels the ask in flight so a stale answer never lands. Until the new answer comes the
 * row's own prices stay on screen under "Updating prices…". `quote` is what the editor shows;
 * `fresh` is the answer for the form as it is now (Apply keeps it instead of asking again).
 */
export function useBulkEditQuote(line: BulkLine, form: EditForm, edit: OrderEdit | undefined) {
  // Hooks
  const [answer, setAnswer] = useState<{ key: string; quote: ParcelQuote } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const ask = bulkEditAsk(line, form, edit)
  const key = ask.state === 'ready' ? ask.key : null
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    debouncedAsk(
      (signal) => api.shipments.quote({ parcels: [JSON.parse(key)] }, { signal }),
      QUOTE_DEBOUNCE_MS,
      controller.signal,
    )
      .then((answers) => {
        const quote = answers?.[0]
        if (!quote) return
        setFailedKey(null)
        setAnswer({ key, quote })
      })
      .catch(() => setFailedKey(key))
    return () => controller.abort()
  }, [key])

  // Render logic
  const fresh = key !== null && answer?.key === key ? answer.quote : null
  const shown = key === null ? line.quote : (fresh ?? answer?.quote ?? line.quote)
  return {
    quote: shown,
    fresh,
    updating: key !== null && fresh === null && failedKey !== key,
    failed: key !== null && failedKey === key,
    waiting: ask.state === 'wait',
  }
}
