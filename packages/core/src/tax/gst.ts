import { sameState } from './states'

export type GstBreakdown = {
  /** Total tax already contained in the amount charged. */
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  ratePercent: number
  /** False when buyer and seller are in the same state (CGST + SGST). */
  interState: boolean
}

export const emptyGst: GstBreakdown = {
  taxPaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  igstPaise: 0,
  ratePercent: 0,
  interState: false,
}

/**
 * Indian retail prices include GST ("inclusive of all taxes"), so tax is
 * extracted from what the shopper paid rather than added to it. The total is
 * never changed by this function.
 *
 * Within a state the tax splits in half between centre and state (CGST/SGST);
 * across states it is one IGST line. The halves are split so they always add
 * back to `taxPaise` exactly, with the odd paisa going to CGST.
 */
export function computeGst(input: {
  /** Amount actually charged for taxable goods, tax included. */
  amountPaise: number
  ratePercent: number
  /** Where the parcel goes; a code or a full state name. */
  shipToState: string | null | undefined
  /** Where the business is registered; a code or a full state name. */
  storeState: string | null | undefined
}): GstBreakdown {
  const { amountPaise, ratePercent } = input
  if (amountPaise <= 0 || ratePercent <= 0)
    return { ...emptyGst, ratePercent: Math.max(0, ratePercent) }

  const taxPaise = Math.round((amountPaise * ratePercent) / (100 + ratePercent))
  /* Unknown store or shipping state cannot be proven to be the same one, and
     IGST is the safer default: it is a single line the merchant can correct. */
  const interState = !sameState(input.shipToState, input.storeState)
  if (interState) {
    return { taxPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise, ratePercent, interState }
  }
  const sgstPaise = Math.floor(taxPaise / 2)
  return {
    taxPaise,
    cgstPaise: taxPaise - sgstPaise,
    sgstPaise,
    igstPaise: 0,
    ratePercent,
    interState,
  }
}
