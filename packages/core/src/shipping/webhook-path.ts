/** SOURCE OF TRUTH: courierWebhookPath, courierForWebhookCode — WHAT: the tracking webhook path a store pastes into its courier, and the neutral alias `/webhooks/shipments/c/<code>/<storeId>` that does not name the courier / WHY: Shiprocket's webhook form is said to refuse a URL containing "shiprocket", so it gets the alias; the admin card and the worker route read the same table (pure, safe in client code) */

/**
 * Short code per courier for the neutral path. Codes are permanent once a merchant pasted the
 * URL: never reuse or change one, only add.
 */
export const COURIER_WEBHOOK_CODES: Readonly<Record<string, string>> = {
  sr: 'shiprocket',
  dl: 'delhivery',
  xb: 'xpressbees',
  ek: 'ekart',
  sf: 'shadowfax',
}

/** Couriers whose card shows the neutral path rather than `/webhooks/shipments/<provider>/...`. */
const NEUTRAL_FOR: ReadonlySet<string> = new Set(['shiprocket'])

/** The provider id a neutral code stands for, or null for a code we never issued. */
export function courierForWebhookCode(code: string): string | null {
  return Object.hasOwn(COURIER_WEBHOOK_CODES, code) ? (COURIER_WEBHOOK_CODES[code] ?? null) : null
}

/** The neutral code for a provider, or null when it has none. */
export function webhookCodeFor(providerId: string): string | null {
  return Object.entries(COURIER_WEBHOOK_CODES).find(([, id]) => id === providerId)?.[0] ?? null
}

/**
 * The path (from the worker's origin) a store pastes into its courier. The provider-named path
 * keeps working for every courier; Shiprocket is shown the neutral one.
 */
export function courierWebhookPath(providerId: string, storeId: string): string {
  const code = NEUTRAL_FOR.has(providerId) ? webhookCodeFor(providerId) : null
  return code
    ? `/webhooks/shipments/c/${code}/${storeId}`
    : `/webhooks/shipments/${providerId}/${storeId}`
}
