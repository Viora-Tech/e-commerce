'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import {
  MANUAL,
  type PackageForm,
  type ParcelQuote,
  type ShipmentDraft,
  startingPick,
} from './flow-state'
import { debouncedAsk, quoteAsk } from './quote-ask'

/** Wait this long after the last package edit before asking the couriers again. */
const QUOTE_DEBOUNCE_MS = 600

/** No courier chosen yet. */
export const NO_PICK = ''

/**
 * Live rates for the page. The couriers are asked only for a complete, valid package, 600 ms
 * after the last edit, and only when the values actually changed (`quoteAsk`'s key); a newer
 * edit cancels the ask in flight, so a stale answer never lands. While a new answer is on its
 * way the last prices stay on screen under "Updating prices…" instead of flickering away. The
 * picked courier is kept when it still answers, else the recommended one is picked. `recheck`
 * asks again without a package change.
 */
export function useShipQuote(
  draft: ShipmentDraft | null,
  parcelId: string | null,
  form: PackageForm | null,
  /** A courier's provider id to start on when it can take the parcel (a courier app's action). */
  preferred?: string | null,
) {
  // Hooks
  const [quote, setQuote] = useState<ParcelQuote | null>(null)
  /* The request the prices on screen answer; differs from the current one while updating. */
  const [quotedKey, setQuotedKey] = useState<string | null>(null)
  /* Nothing is picked until the couriers answer; "Ship it yourself" is only ever the merchant's
     choice or the fallback when no courier can take the parcel. */
  const [pick, setPick] = useState(NO_PICK)
  const [retry, setRetry] = useState(0)
  /* The last ask failed: the card says so with a retry instead of spinning forever. */
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const ask = draft && form && draft.couriers.length > 0 ? quoteAsk(draft, parcelId, form) : null
  const key = ask?.state === 'ready' ? ask.key : null
  const failed = key !== null && failedKey === key
  useEffect(() => {
    if (!key || retry < 0) return
    const controller = new AbortController()
    debouncedAsk(
      (signal) => api.shipments.quote({ parcels: [JSON.parse(key)] }, { signal }),
      QUOTE_DEBOUNCE_MS,
      controller.signal,
    )
      .then((answers) => {
        if (!answers) return
        const answer = answers[0] ?? null
        setFailedKey(null)
        setQuote(answer)
        setQuotedKey(key)
        setPick((current) =>
          current === MANUAL || answer?.options.some((r) => r.optionKey === current)
            ? current
            : startingPick(answer?.options ?? [], preferred),
        )
      })
      .catch((err) => {
        setFailedKey(key)
        toast.error(err instanceof Error ? err.message : String(err))
      })
    return () => controller.abort()
  }, [key, retry, preferred])

  return {
    /* Couriers can only price a parcel with a weight; until then there is nothing to show. */
    quote: ask?.state === 'needs_package' ? null : quote,
    pick,
    setPick,
    recheck: () => {
      setQuotedKey(null)
      setFailedKey(null)
      setRetry((n) => n + 1)
    },
    failed,
    needsPackage: ask?.state === 'needs_package',
    /* Half a box size typed: the prices on screen wait for the rest. */
    waitingForSize: ask?.state === 'incomplete',
    /* A new answer is on its way for a changed package; the old prices stay meanwhile. */
    updating: key !== null && key !== quotedKey && !failed,
  }
}
