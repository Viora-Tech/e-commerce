import { settingsSecret } from '@commerce/config'
import { confirmClientPayment, orderViewToken, thankYouPath } from '@commerce/core'
import { order, payment } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { nudgeOutbox } from '@/lib/outbox'
import { storePaymentProviders } from '@/lib/payments'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { redirectTo } from '@/lib/redirect'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; provider: string }> }

/** A shopper comes back once or twice; a burst from one address is not a shopper. */
const RETURN_IP_RULE = { limit: 30, windowMs: 60_000 }

/** Bigger posts are not a gateway's return. */
const MAX_BODY_CHARS = 64_000

/** The gateway's fields: the query string, then a form or JSON body over it. */
async function returnFields(request: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [k, v] of request.nextUrl.searchParams) out[k] = v
  if (request.method !== 'POST') return out
  const raw = (await request.text().catch(() => '')).slice(0, MAX_BODY_CHARS)
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    try {
      const body: unknown = JSON.parse(raw)
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [k, v] of Object.entries(body)) {
          if (v !== null && typeof v !== 'object') out[k] = String(v)
        }
      }
    } catch {
      // Not JSON after all: nothing more to read.
    }
    return out
  }
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v
  return out
}

/**
 * GET or POST /checkout/return/<provider>: a redirect gateway (Snapmint) sends the shopper back
 * here. The post only says which attempt it is about; the gateway's own status API decides what
 * is recorded (`confirm`). A return the gateway signed opens the order page with a fresh view
 * token; an unsigned one opens it only for the browser that placed the order (its cookie).
 */
async function handleReturn(request: NextRequest, { params }: Params) {
  const { storeId, provider: providerId } = await params
  const limit = await rateLimited('payment-return:ip', clientIp(request.headers), RETURN_IP_RULE)
  if (!limit.ok) return redirectTo('/', 303)
  const fields = await returnFields(request)

  const outcome = await inStore(storeId, async (tx) => {
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === providerId)
    const ret = provider?.parseReturn?.(fields)
    if (!provider || !ret) return null
    const [attempt] = await tx
      .select({ orderId: payment.orderId })
      .from(payment)
      .where(eq(payment.providerRef, ret.providerRef))
    if (!attempt) return null
    const applied = await confirmClientPayment(
      { storeId, tx },
      provider,
      ret.providerRef,
      fields,
    ).catch((err: unknown) => {
      // The gateway's status API is down: the webhook or the unpaid-order check records it later.
      logger.warn('payment return could not be confirmed', { storeId, providerId, error: err })
      return null
    })
    // Read after the capture: a paid checkout draft has just become a numbered order.
    const [o] = await tx
      .select({ id: order.id, number: order.number })
      .from(order)
      .where(eq(order.id, attempt.orderId))
    return o ? { order: o, verified: ret.verified, captured: !!applied?.becameCaptured } : null
  })

  if (!outcome) return redirectTo('/', 303)
  if (outcome.captured) await nudgeOutbox(storeId)
  const { order: o } = outcome
  // The proxy moves `?t=` into the order page's cookie before the page renders.
  return redirectTo(
    outcome.verified
      ? thankYouPath(o.number, orderViewToken(o.id, settingsSecret()))
      : `/checkout/thank-you/${o.number < 0 ? `D${-o.number}` : o.number}`,
    303,
  )
}

export const GET = withEvlog(handleReturn)
export const POST = withEvlog(handleReturn)
