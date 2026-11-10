/** The shapes of ShipGlobal's vendor API answers (`/apiv1/...`), as far as the docs show them. */

/** Every answer carries `success`; a refusal adds `error` (and often `error_code`) or `msg`. */
export type Answer = {
  success?: boolean
  error?: string
  error_code?: string
  msg?: string
  message?: string
}

export type RatesResponse = Answer & {
  billed_weight?: number
  billed_weight_unit?: string
  currency?: string
  services?: {
    title?: string
    notes?: string
    transit_time?: string
    price?: { logistic_fee?: number }
    subtotal_fee?: number
  }[]
}

/**
 * VERIFY: the docs show no answer for order/add. ShipGlobal's other answers put the number in
 * `tracking`, so that is read first, then the likely nested spellings.
 */
export type AddOrderResponse = Answer & {
  tracking?: string
  awb?: string
  awb_number?: string
  data?: { tracking?: string; awb?: string; awb_number?: string; order_reference?: string }
}

export type LabelResponse = Answer & { tracking?: string; label?: string }

export type TrackingResponse = Answer & {
  data?: {
    awbEvents?: {
      awb_history_datetime?: string
      awb_history_location?: string
      awb_history_comment?: string
      awb_event_code?: string
    }[]
  }
}

export const reasonOf = (a: Answer) => (a.error || a.msg || a.message || '').trim()
