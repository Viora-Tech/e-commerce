/** SOURCE OF TRUTH: courier tracking numbers — WHAT: courier list, number patterns and tracking links / WHY: the fulfilment dialog detects the courier from what is pasted */
/**
 * Which courier a tracking number belongs to, and the page a shopper opens to
 * follow it. Pure and browser-safe (`@commerce/core/tracking-numbers`): the
 * fulfilment dialog runs it on every keystroke to pre-select the courier, the
 * way Shopify does, and the merchant can always pick another.
 *
 * Indian couriers do not publish their number formats. The patterns below come
 * from courier help pages where one exists and otherwise from public tracker
 * listings (AfterShip, Ship24, TrackingMore, ParcelPanel), which agree on the
 * formats used here. Where two couriers share a shape (most plain digit runs),
 * the rule lists every courier it could be and `detectCourier` returns no
 * pick, so the dialog stays on "Other" and offers the candidates as hints.
 * Only formats with letters or a checksum are treated as certain.
 */

export type CourierId =
  | 'delhivery'
  | 'delhivery_b2b'
  | 'shiprocket'
  | 'bluedart'
  | 'dtdc'
  | 'ecom_express'
  | 'xpressbees'
  | 'india_post'
  | 'ekart'
  | 'shadowfax'
  | 'amazon_shipping'
  | 'ekart_large'
  | 'smartr'
  | 'professional'
  | 'trackon'
  | 'gati'
  | 'other'

export type Courier = {
  id: CourierId
  /** What the merchant sees and what is stored as the shipment's courier. */
  name: string
  /** Other names people type, for the searchable dropdown. */
  aliases?: string[]
  /**
   * The courier's public tracking page. `{n}` is replaced by the number when
   * the page takes it in the link; without `{n}` the page opens empty and the
   * shopper pastes the number there.
   */
  trackingPage: string | null
}

/**
 * Couriers offered in the dropdown, most used first. Tracking pages:
 * - Delhivery: the link our own Delhivery adapter hands out
 *   (`packages/shipping-delhivery/src/delhivery.ts`).
 * - Blue Dart: `trackdartresultthirdparty?trackFor=0&trackNo=`, Blue Dart's own
 *   deep link (https://www.bluedart.com/web/guest/trackdartresultthirdparty).
 * - Everyone else: the courier's tracking page without the number, because a
 *   deep link could not be confirmed from the courier's own site.
 */
export const COURIERS: readonly Courier[] = [
  {
    id: 'delhivery',
    name: 'Delhivery',
    trackingPage: 'https://www.delhivery.com/track/package/{n}',
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    aliases: ['shiprocket courier', 'sr'],
    trackingPage: 'https://www.shiprocket.in/shipment-tracking/',
  },
  {
    id: 'bluedart',
    name: 'Blue Dart',
    aliases: ['bluedart', 'blue dart express', 'dhl'],
    trackingPage:
      'https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo={n}',
  },
  {
    id: 'dtdc',
    name: 'DTDC',
    trackingPage: 'https://www.dtdc.com/track-your-shipment/',
  },
  {
    id: 'ecom_express',
    name: 'Ecom Express',
    aliases: ['ecom'],
    trackingPage: 'https://www.ecomexpress.in/tracking/',
  },
  {
    id: 'xpressbees',
    name: 'XpressBees',
    aliases: ['xpress bees', 'busybees'],
    trackingPage: 'https://www.xpressbees.com/shipment/tracking',
  },
  {
    id: 'india_post',
    name: 'India Post',
    aliases: ['speed post', 'registered post', 'post office'],
    trackingPage: 'https://www.indiapost.gov.in/',
  },
  {
    id: 'ekart',
    name: 'Ekart',
    aliases: ['ekart logistics', 'flipkart'],
    trackingPage: 'https://ekartlogistics.com/',
  },
  {
    id: 'shadowfax',
    name: 'Shadowfax',
    trackingPage: 'https://tracker.shadowfax.in/',
  },
  {
    id: 'amazon_shipping',
    name: 'Amazon Shipping',
    aliases: ['ats', 'amazon transportation services', 'amazon'],
    trackingPage: 'https://track.amazon.in/',
  },
  {
    id: 'delhivery_b2b',
    name: 'Delhivery B2B',
    aliases: ['delhivery freight', 'delhivery ltl'],
    trackingPage: 'https://www.delhivery.com/',
  },
  {
    id: 'ekart_large',
    name: 'Ekart Large',
    trackingPage: 'https://ekartlogistics.com/',
  },
  {
    id: 'smartr',
    name: 'Smartr Logistics',
    trackingPage: null,
  },
  {
    id: 'professional',
    name: 'The Professional Couriers',
    aliases: ['tpc', 'professional couriers'],
    trackingPage: null,
  },
  {
    id: 'trackon',
    name: 'Trackon',
    trackingPage: null,
  },
  {
    id: 'gati',
    name: 'Gati',
    aliases: ['allcargo gati'],
    trackingPage: null,
  },
  { id: 'other', name: 'Other', trackingPage: null },
]

type Rule = {
  /** What the rule matches, on the number with spaces and dashes removed and upper-cased. */
  pattern: RegExp
  /** One courier: a certain match. Several: the shape is shared, so no pick. */
  couriers: CourierId[]
  /** Extra check beyond the pattern (a checksum). */
  valid?: (n: string) => boolean
  /** Unconfirmed against the courier itself: offered as a hint even when it names one courier. */
  hintOnly?: true
}

/**
 * UPU S10 check digit: weights 8 6 4 2 3 5 9 7 over the eight serial digits,
 * 11 minus the sum mod 11, with 10 → 0 and 11 → 5.
 * Source: UPU S10 standard, https://en.wikipedia.org/wiki/S10_(UPU_standard).
 */
export function s10CheckDigitValid(n: string): boolean {
  const digits = n.slice(2, 11)
  if (!/^\d{9}$/.test(digits)) return false
  const weights = [8, 6, 4, 2, 3, 5, 9, 7]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0)
  const raw = 11 - (sum % 11)
  const check = raw === 10 ? 0 : raw === 11 ? 5 : raw
  return check === Number(digits[8])
}

const RULES: Rule[] = [
  /* India Post: UPU S10, two letters, eight digits, a check digit, "IN"
     (EE123456785IN for Speed Post, RN… for Registered Post, CP… for parcels).
     Certain: the checksum rules out chance matches. Source: UPU S10 standard,
     https://en.wikipedia.org/wiki/S10_(UPU_standard); India Post prefixes,
     https://www.speedindiapost.com/blog/india-post-consignment-number-explained */
  { pattern: /^[A-Z]{2}\d{9}IN$/, couriers: ['india_post'], valid: s10CheckDigitValid },
  /* Ekart: four letters starting FMP (FMPC, FMPP) then 10 digits, e.g.
     FMPC0123456789. Source: https://www.ship24.com/couriers/ekart-logistics-tracking,
     https://www.trackingmore.com/ekart-tracking. The prefix itself is not documented
     by Ekart; only FMP… is matched so other four-letter codes stay "Other". */
  { pattern: /^FMP[A-Z]\d{10,12}$/, couriers: ['ekart'] },
  /* Shadowfax: "SF", 10 to 13 digits, then one to three letters, e.g. SF2964097734F,
     SF1234567890SIN. Source: https://www.ship24.com/couriers/shadowfax-tracking,
     https://www.trackingmore.com/shadowfax-tracking. */
  { pattern: /^SF\d{10,13}[A-Z]{1,3}$/, couriers: ['shadowfax'] },
  /* DTDC: one letter then eight digits, e.g. D57291883, Z12345678. Source:
     https://www.aftership.com/carriers/dtdc, https://www.parcelpanel.com/couriers/dtdc/.
     No other courier in this list is reported with this shape. */
  { pattern: /^[A-Z]\d{8}$/, couriers: ['dtdc'] },
  /* Delhivery B2B freight uses LR numbers; their format is not published, so no rule. */

  /* Plain digit runs are shared between couriers, so none of these picks one.
     Blue Dart: 11 digits is its standard domestic waybill
     (https://www.bluedart.com/how-to-track, https://www.ship24.com/couriers/bluedart-tracking),
     but Ecom Express is also reported with 9 to 11 digits
     (https://www.ship24.com/couriers/ecom-express-tracking). */
  { pattern: /^\d{11}$/, couriers: ['bluedart', 'ecom_express'] },
  /* 12 digits: Amazon Shipping (ATS, https://track91.com/amazon-india), numeric DTDC
     (https://www.aftership.com/carriers/dtdc) and short Delhivery waybills. */
  { pattern: /^\d{12}$/, couriers: ['amazon_shipping', 'delhivery', 'dtdc'] },
  /* 13 digits: Delhivery (12 to 15, https://track91.com/delhivery) and Ecom Express. */
  { pattern: /^\d{13}$/, couriers: ['delhivery', 'ecom_express'] },
  /* 14 to 15 digits: Delhivery and XpressBees both issue these
     (https://track91.com/xpressbees, https://www.parcelpanel.com/couriers/xpressbees/). */
  { pattern: /^\d{14,15}$/, couriers: ['delhivery', 'xpressbees'] },
  /* 16 digits: XpressBees only, per https://www.parcelpanel.com/couriers/xpressbees/.
     Unverified against the courier itself, so still offered as a hint, not a pick. */
  { pattern: /^\d{16}$/, couriers: ['xpressbees'], hintOnly: true },
]

/** Spaces, dashes and dots people paste from labels, gone; letters upper-cased. */
export function normaliseTrackingNumber(raw: string): string {
  return raw.replace(/[\s.\-/]/g, '').toUpperCase()
}

export type CourierGuess = {
  /** The courier to pre-select; null when the number fits several, or none. */
  courier: CourierId | null
  /** Couriers the number could belong to, best first; empty when nothing matched. */
  candidates: CourierId[]
}

/** Best guess at the courier for a tracking number. */
export function detectCourier(raw: string): CourierGuess {
  const n = normaliseTrackingNumber(raw)
  if (n.length < 8) return { courier: null, candidates: [] }
  for (const rule of RULES) {
    if (!rule.pattern.test(n)) continue
    if (rule.valid && !rule.valid(n)) continue
    const sure = rule.couriers.length === 1 && !rule.hintOnly
    return { courier: sure ? (rule.couriers[0] ?? null) : null, candidates: [...rule.couriers] }
  }
  return { courier: null, candidates: [] }
}

export function courierById(id: string): Courier | null {
  return COURIERS.find((c) => c.id === id) ?? null
}

/** The courier whose name or alias matches what was typed or stored, ignoring case. */
export function courierByName(name: string): Courier | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  return COURIERS.find((c) => c.name.toLowerCase() === q || c.aliases?.some((a) => a === q)) ?? null
}

/** Whether the courier's name or an alias contains the query, ignoring case. */
export function courierMatches(c: Courier, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return c.name.toLowerCase().includes(q) || Boolean(c.aliases?.some((a) => a.includes(q)))
}

/** Couriers whose name or alias contains the query, for the searchable dropdown. */
export function searchCouriers(query: string): Courier[] {
  return COURIERS.filter((c) => courierMatches(c, query))
}

/**
 * The link a shopper opens to follow the parcel. Null for "Other" and couriers
 * with no public page; the courier's page without the number when it cannot
 * take the number in the link.
 */
export function trackingUrlFor(courierId: string, trackingNumber: string): string | null {
  const page = courierById(courierId)?.trackingPage
  const n = normaliseTrackingNumber(trackingNumber)
  if (!page || !n) return null
  return page.includes('{n}') ? page.replace('{n}', encodeURIComponent(n)) : page
}
