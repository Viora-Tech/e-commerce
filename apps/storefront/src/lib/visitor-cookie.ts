/** Anonymous per-browser id for the live-visitor count; not linked to a person or an order. */
export const VISITOR_COOKIE = 'wc_vid'
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only our own ids reach Dragonfly; anything else is treated as absent. */
export function parseVisitorId(value: string | undefined): string | null {
  return value && UUID.test(value) ? value : null
}
