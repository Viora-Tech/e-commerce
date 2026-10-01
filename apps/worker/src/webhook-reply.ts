import type { Context } from 'hono'

/**
 * One answer for every rejected payment or courier webhook, whatever the reason: unknown or
 * malformed store id, a provider the store has not enabled, a bad signature or token
 * (security audit D-11). Separate answers let anyone probe which store ids exist and which
 * gateway or courier each store uses. The real reason goes to the server log only.
 *
 * 400, not 5xx: gateways and couriers retry 5xx answers forever.
 */
export const WEBHOOK_REJECTED_STATUS = 400
export const WEBHOOK_REJECTED_BODY = { ok: false } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A store id that could exist; anything else is rejected before the database sees it. */
export function isStoreId(value: string): boolean {
  return UUID.test(value)
}

export function rejectWebhook(
  c: Context,
  label: string,
  where: { providerId: string; storeId: string },
  reason: string,
) {
  console.warn(`[${label}] ${where.providerId}/${where.storeId} rejected: ${reason}`)
  return c.json(WEBHOOK_REJECTED_BODY, WEBHOOK_REJECTED_STATUS)
}

/**
 * The TCP peer address Bun saw, for `clientIp` when no proxy header is trusted
 * (`TRUSTED_PROXY=none`). Null when the request did not come through `Bun.serve` (tests).
 */
export function peerAddress(c: Context): string | null {
  // Bun passes its server as the second `fetch` argument, which Hono exposes as `c.env`.
  // (`hono/bun`'s getConnInfo does the same but needs the Bun global at import time.)
  const server = c.env as { requestIP?: (req: Request) => { address?: string } | null } | undefined
  try {
    return server?.requestIP?.(c.req.raw)?.address ?? null
  } catch {
    return null
  }
}
