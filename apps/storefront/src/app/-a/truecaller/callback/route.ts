import { settingsSecret } from '@commerce/config'
import { completeTruecaller, storeFromTruecallerNonce } from '@commerce/core'
import { NextResponse } from 'next/server'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

/**
 * Truecaller's server calls this with the shopper's access token (or their refusal). The
 * store comes from our signed request nonce, never from the body; the profile is fetched
 * only from truecaller.com. Always 200, so a probe learns nothing.
 */
export const POST = withEvlog(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const secret = settingsSecret()
  const storeId = body ? storeFromTruecallerNonce(body.requestId, secret) : null
  if (body && storeId) {
    await inStore(storeId, (tx) =>
      completeTruecaller({ tx, storeId }, body, { secret, fetch: (url, init) => fetch(url, init) }),
    )
  }
  return NextResponse.json({ ok: true })
})
