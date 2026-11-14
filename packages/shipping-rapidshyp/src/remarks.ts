/**
 * RapidShyp's refusal remarks in words a merchant can act on. RapidShyp answers a refusal with a
 * short remark ("Invalid store name"), either as a 4xx body or a 200 with `status: FAILED`; the
 * ones below are seen in production or read off its docs. Matching is loose on purpose, since
 * the exact wording is not documented. An unknown remark is shown as RapidShyp wrote it.
 */
/** "Awb can not assign with this shipment id": the shipment already has an AWB. */
export const AWB_TAKEN =
  /awb\s*(can\s*not|cannot|can't)\s*(be\s*)?assign|awb\s*(is\s*)?already\s*assigned/i

const KNOWN: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /invalid\s*store|store\s*name.*(invalid|not\s*found|not\s*exist|incorrect)/i,
    "RapidShyp didn't accept the Store name in Apps → RapidShyp → Connect. It is usually DEFAULT.",
  ],
  [
    /(invalid|incorrect)\s*pickup|pickup\s*(address|location)?\s*(name\s*)?(is\s*)?(invalid|not\s*found|does\s*not\s*exist|not\s*exist)/i,
    "RapidShyp has no pickup location by the name in Apps → RapidShyp → Connect. Copy it exactly from RapidShyp's Pickup locations page.",
  ],
  [
    AWB_TAKEN,
    'RapidShyp already has a courier on this shipment, so it could not switch to another one. Cancel the shipment on RapidShyp, then book again here.',
  ],
  [
    /order.*already\s*exist/i,
    'RapidShyp already has an order with this order number. Cancel or delete it on RapidShyp, then book again here.',
  ],
  [
    /(insufficient|low)\s*(wallet\s*)?balance|recharge/i,
    'Your RapidShyp wallet does not have enough balance for this booking. Recharge it on RapidShyp, then book again.',
  ],
  [
    /not\s*serviceable|non[-\s]?serviceable|no\s*courier/i,
    "This courier doesn't deliver to this PIN code through RapidShyp. Pick another courier.",
  ],
  [
    /invalid\s*(pin\s*code|pincode)/i,
    'RapidShyp did not accept the PIN code. Check the delivery address on the order.',
  ],
  [
    /(invalid|incorrect)\s*(phone|mobile|contact)/i,
    'RapidShyp did not accept the phone number. Check the 10-digit number on the delivery address.',
  ],
  [
    /(invalid|incorrect)\s*(package\s*)?weight|weight\s*(is\s*)?(invalid|exceed|must|should)/i,
    "RapidShyp did not accept the parcel's weight. Check the weight entered for this parcel.",
  ],
]

/** The merchant-facing sentence for a known RapidShyp remark, or null for one we do not know. */
export function explainRapidshypRemark(remark: string | null | undefined): string | null {
  const text = remark?.trim()
  if (!text) return null
  return KNOWN.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/**
 * A refusal for the merchant: the known explanation with RapidShyp's own words at the end in
 * brackets, else `fallback: remark` as before.
 */
export function rapidshypRefusal(fallback: string, remark: string | null | undefined): string {
  const raw = remark?.trim()
  const known = explainRapidshypRemark(raw)
  if (known) return `${known} (${raw})`
  return `${fallback}: ${raw || 'no detail returned'}`
}

/** RapidShyp already holds an order with the id we sent (a rebook, or an order made there). */
export const isDuplicateOrderRemark = (remark: string | null | undefined) =>
  /order.*already\s*exist/i.test(remark ?? '')
