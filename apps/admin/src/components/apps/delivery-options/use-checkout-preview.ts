'use client'

import type { DeliveryLayout, DeliveryOption } from '@commerce/core/delivery-options'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { TryPinResult } from './format'

/** The preview shopper (Figma 929:11373, 938:12101): Bengaluru, a 2 kg ₹2,499 prepaid cart. */
export const PREVIEW_PIN = '560038'
export const PREVIEW_CART = { valuePaise: 249_900, weightGrams: 2000 } as const

export type PreviewDraft = { layout: DeliveryLayout; options: DeliveryOption[] }

/** How long edits settle before the preview asks again. */
const SETTLE_MS = 500

/**
 * The cards checkout shows the preview shopper, from the couriers' cached answers (a live call
 * only when nothing is cached). With a `draft`, the page's unsaved edits are priced instead of
 * what is saved; edits settle for half a second first.
 */
export function useCheckoutPreview(
  draft: PreviewDraft | null,
  pincode: string = PREVIEW_PIN,
  /** False: ask nothing (the page shows no preview right now). */
  enabled = true,
): { result: TryPinResult | null; loading: boolean; failed: boolean } {
  const [result, setResult] = useState<TryPinResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const key = JSON.stringify(draft)

  useEffect(() => {
    if (!enabled) return
    let live = true
    setLoading(true)
    const parsed = key === 'null' ? null : (JSON.parse(key) as PreviewDraft)
    const timer = setTimeout(
      () => {
        api.deliveryOptions
          .tryPin({
            pincode,
            valuePaise: PREVIEW_CART.valuePaise,
            weightGrams: PREVIEW_CART.weightGrams,
            productIds: [],
            declineInsurance: false,
            cached: true,
            ...(parsed ? { draft: parsed } : {}),
          })
          .then((r) => {
            if (!live) return
            setResult(r)
            setFailed(false)
          })
          .catch(() => {
            if (live) setFailed(true)
          })
          .finally(() => {
            if (live) setLoading(false)
          })
      },
      parsed ? SETTLE_MS : 0,
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, pincode, enabled])

  return { result, loading, failed }
}
