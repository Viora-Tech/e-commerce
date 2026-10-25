import { useEffect, useState } from 'react'
import { checkoutGstAction } from './gst-actions'
import { retryOnce } from './retry-once'

/** Settle time before asking: typing a PIN or switching rates changes the total in bursts. */
const WAIT_MS = 300

/**
 * The GST inside the checkout total, for "Includes ₹X GST" in the summary. Null until known
 * (and when the cart is gone), so the summary falls back to "Inclusive of all taxes".
 */
export function useCheckoutGst(input: {
  totalPaise: number
  reductionPaise: number
  stateCode: string | null
}): number | null {
  const [gstPaise, setGstPaise] = useState<number | null>(null)
  const { totalPaise, reductionPaise, stateCode } = input

  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      retryOnce(() => checkoutGstAction({ totalPaise, reductionPaise, stateCode }))
        .then((r) => live && setGstPaise(r ? r.taxPaise : null))
        .catch(() => live && setGstPaise(null))
    }, WAIT_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [totalPaise, reductionPaise, stateCode])

  return gstPaise
}
