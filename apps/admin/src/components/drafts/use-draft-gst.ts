'use client'

import { useEffect, useState } from 'react'
import {
  type DraftFormState,
  draftStateCode,
  linePayload,
} from '@/components/drafts/draft-form-state'
import { api } from '@/lib/api-client'

const ESTIMATE_DELAY_MS = 400

export type DraftGst = { taxPaise: number; ratePercent: number | null }

/**
 * "GST (estimated)" for the draft as typed (audit #30): the server works it out the way
 * converting bills it (each line's rate, the store's composition switch, the discount spread over
 * the lines), a moment after the lines, discount, shipping or state change. `seed` is the saved
 * draft's GST, shown until the first answer.
 */
export function useDraftGst(
  form: DraftFormState,
  totals: { totalPaise: number; discountPaise: number },
  seed: DraftGst | null,
): DraftGst | null {
  const [gst, setGst] = useState<DraftGst | null>(seed)
  const request = {
    lines: form.lines.map(linePayload),
    totalPaise: Math.max(0, totals.totalPaise),
    reductionPaise: totals.discountPaise,
    stateCode: draftStateCode(form),
  }
  const key = JSON.stringify(request)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the request's content; the object itself changes on every render.
  useEffect(() => {
    if (request.lines.length === 0) {
      setGst(null)
      return
    }
    let live = true
    const timer = setTimeout(() => {
      api.orders
        .estimateDraftGst(request)
        .then((r) => live && r && setGst({ taxPaise: r.taxPaise, ratePercent: r.ratePercent }))
        .catch(() => undefined)
    }, ESTIMATE_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key])

  return form.lines.length === 0 ? null : gst
}
