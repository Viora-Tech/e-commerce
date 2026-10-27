/** SOURCE OF TRUTH: INBOUND_CARRIERS, inboundTrackingUrl — WHAT: the carriers an import consignment can be tracked with and their public tracking pages / WHY: the inbound shipment page links to the carrier and, when that carrier is connected as a shipping app (FedEx, DHL Express, Blue Dart, Delhivery), reads its expected delivery date */

/**
 * Carriers offered on an inbound shipment. `courier` is the shipping app whose tracking API
 * gives the expected date when it is connected; `url` builds the public tracking page.
 */
export const INBOUND_CARRIERS = {
  fedex: {
    label: 'FedEx',
    courier: 'fedex',
    url: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  },
  dhl: {
    label: 'DHL Express',
    courier: 'dhl-express',
    url: (n: string) => `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${n}`,
  },
  ups: {
    label: 'UPS',
    courier: null,
    url: (n: string) => `https://www.ups.com/track?tracknum=${n}`,
  },
  bluedart: {
    label: 'Blue Dart',
    courier: 'bluedart',
    url: (n: string) =>
      `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${n}`,
  },
  delhivery: {
    label: 'Delhivery',
    courier: 'delhivery',
    url: (n: string) => `https://www.delhivery.com/track-v2/package/${n}`,
  },
  aramex: {
    label: 'Aramex',
    courier: null,
    url: (n: string) => `https://www.aramex.com/in/en/track/results?ShipmentNumber=${n}`,
  },
  other: { label: 'Other', courier: null, url: null },
} as const satisfies Record<
  string,
  { label: string; courier: string | null; url: ((n: string) => string) | null }
>

export type InboundCarrier = keyof typeof INBOUND_CARRIERS
export const INBOUND_CARRIER_IDS = Object.keys(INBOUND_CARRIERS) as InboundCarrier[]

export const isInboundCarrier = (v: string | null | undefined): v is InboundCarrier =>
  !!v && Object.hasOwn(INBOUND_CARRIERS, v)

/** The link to open: the one typed, else the carrier's page for the number; null when neither. */
export function inboundTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  typed?: string | null | undefined,
): string | null {
  if (typed?.trim()) return typed.trim()
  const number = trackingNumber?.trim()
  if (!number || !isInboundCarrier(carrier)) return null
  const build = INBOUND_CARRIERS[carrier].url
  return build ? build(encodeURIComponent(number)) : null
}

/** The shipping app that can read this carrier's tracking, or null. */
export function inboundTrackingCourier(carrier: string | null | undefined): string | null {
  return isInboundCarrier(carrier) ? INBOUND_CARRIERS[carrier].courier : null
}
