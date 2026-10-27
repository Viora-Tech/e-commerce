'use client'

import { useEffect, useState } from 'react'
import {
  type DraftCodeCheck,
  type DraftFormState,
  draftStateCode,
} from '@/components/drafts/draft-form-state'
import { api } from '@/lib/api-client'

const CHECK_DELAY_MS = 400

/** What a code is checked against: the lines, the customer's email, the state and shipping. */
function codeRequest(form: DraftFormState) {
  return {
    lines: form.lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
    })),
    email: form.email || null,
    stateCode: draftStateCode(form),
    shippingPaise: form.shippingPaise,
  }
}

/**
 * The draft's discount code as the server sees it right now. It re-checks a moment after the
 * lines, customer, address or shipping change, so the Payment card shows what Save will apply
 * (or why the code stopped applying). `check` is null while there is no code.
 */
export function useDraftCodeCheck(form: DraftFormState, seed: DraftCodeCheck | null) {
  const [check, setCheck] = useState<DraftCodeCheck | null>(seed)
  const code = form.discountCode
  const request = codeRequest(form)
  const key = JSON.stringify(request)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the request's content; the object itself changes on every render.
  useEffect(() => {
    if (!code) return
    let live = true
    const timer = setTimeout(() => {
      api.orders
        .checkDraftDiscount({ code, ...request })
        .then((r) => live && setCheck(r))
        .catch(() => undefined)
    }, CHECK_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [code, key])

  return {
    check: code ? check : null,
    /** Run a check now (the Apply button); resolves with the server's answer. */
    apply: async (typed: string) => {
      const r = await api.orders.checkDraftDiscount({ code: typed, ...request })
      if (r.ok) setCheck(r)
      return r
    },
  }
}
