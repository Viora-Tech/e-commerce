import { channelDeps, queueChannelSync } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import {
  ChannelApiError,
  completeChannelConnect,
  isAiAgent,
  memberAccess,
  verifyChannelState,
} from '@commerce/core'
import { withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { channelSyncQueue } from '@commerce/queue'
import { type NextRequest, NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { routes } from '@/lib/routes'

type Context = { params: Promise<{ provider: string }> }

/**
 * Meta or Google sends the merchant back here after "Connect" with a one-time `code` and our
 * signed `state` (or an error when they said no). The signed-in member must belong to the store
 * the state names; then the code becomes saved access, the catalog is found or made, and the
 * first sync is queued. The merchant lands back on the channel's page either way, with the
 * partner's reason when it refused.
 */
export async function GET(req: NextRequest, { params }: Context) {
  const { provider } = await params
  const code = req.nextUrl.searchParams.get('code')
  const raw = req.nextUrl.searchParams.get('state') ?? ''
  const deps = channelDeps()
  const s = verifyChannelState(raw, deps.secret)
  const page = s
    ? isAiAgent(s.channel)
      ? routes.salesChannels.agentic()
      : routes.salesChannels.socialChannel(s.channel)
    : routes.salesChannels.social()
  const back = adminUrl(page)
  const done = (result: string, reason?: string) => {
    back.searchParams.set('connect', result)
    // The partner's own words ("No Google Merchant Center account found…"), shown in the toast.
    if (reason) back.searchParams.set('reason', reason.slice(0, 300))
    return NextResponse.redirect(back)
  }
  if ((provider !== 'meta' && provider !== 'google') || !s) {
    logger.warn('sales channel connect: bad or expired state', { provider })
    return done('failed')
  }
  if (!code) return done('cancelled')
  const session = await getSession()
  if (!session) return NextResponse.redirect(adminUrl(routes.login()))
  const member = await withStore(db(), s.storeId, (tx) =>
    memberAccess(tx, s.storeId, session.user.id),
  )
  if (!member) {
    logger.warn('sales channel connect: signed-in user is not a member of the store', { provider })
    return done('failed')
  }
  try {
    const r = await completeChannelConnect(db(), { provider, code, state: raw }, deps)
    await queueChannelSync(channelSyncQueue(loadEnv(process.env).REDIS_URL), r.storeId, r.channel)
    return done('connected')
  } catch (error) {
    logger.error('sales channel connect failed', {
      provider,
      channel: s.channel,
      error: error instanceof Error ? error.message : String(error),
    })
    return done('failed', error instanceof ChannelApiError ? error.message : undefined)
  }
}
