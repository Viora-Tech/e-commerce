'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import {
  MANUAL,
  type PackageForm,
  type ParcelQuote,
  parsePackage,
  quoteRequest,
  type ShipmentDraft,
  startingPick,
} from './flow-state'

/** Wait this long after the last package edit before asking the couriers again. */
const QUOTE_DEBOUNCE_MS = 600

/** No courier chosen yet. */
export const NO_PICK = ''

/**
 * Live rates for the page: ask every courier a moment after the package stops changing, keep
 * the picked courier when it still answers, else start on the recommended one. `recheck` asks
 * again without a package change.
 */
export function useShipQuote(
  draft: ShipmentDraft | null,
  parcelId: string | null,
  form: PackageForm | null,
) {
  // Hooks
  const [quote, setQuote] = useState<ParcelQuote | null>(null)
  /* Nothing is picked until the couriers answer; "Ship it yourself" is only ever the merchant's
     choice or the fallback when no courier can take the parcel. */
  const [pick, setPick] = useState(NO_PICK)
  const [retry, setRetry] = useState(0)
  /* The last quote failed: the card says so with a retry instead of spinning forever. */
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const o = draft?.orders[0]
    const p = o?.parcels.find((x) => x.id === parcelId) ?? o?.parcels[0]
    const pkg = form ? parsePackage(form) : null
    if (!draft || !o || !p || !form || !pkg || draft.couriers.length === 0 || retry < 0) {
      setQuote(null)
      return
    }
    let live = true
    setQuote(null)
    setFailed(false)
    const timer = setTimeout(() => {
      api.shipments
        .quote({ parcels: [quoteRequest(o, p, form, pkg)] })
        .then(([answer]) => {
          if (!live) return
          setQuote(answer ?? null)
          setPick((current) =>
            current === MANUAL || answer?.options.some((r) => r.providerId === current)
              ? current
              : startingPick(answer?.options ?? []),
          )
        })
        .catch((err) => {
          if (!live) return
          setFailed(true)
          toast.error(err instanceof Error ? err.message : String(err))
        })
    }, QUOTE_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [draft, parcelId, form, retry])

  return {
    quote,
    pick,
    setPick,
    recheck: () => setRetry((n) => n + 1),
    failed,
    /* Couriers can only price a parcel with a weight; until then there is nothing to ask. */
    needsPackage: form !== null && parsePackage(form) === null,
  }
}
