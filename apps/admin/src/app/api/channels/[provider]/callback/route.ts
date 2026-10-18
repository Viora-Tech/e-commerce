import { channelDeps, queueChannelSync } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import { completeChannelConnect, isAiAgent, memberAccess, verifyChannelState } from '@commerce/core'
import { withStore } from '@commerce/db'
import { channelSyncQueue } from '@commerce/queue'
import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { routes } from '@/lib/routes'

type Context = { params: Promise<{ provider: string }> }

/**
 * Meta or Google sends the merchant back here after "Connect" with a one-time `code` and our
 * signed `state` (or an error when they said no). The signed-in member must belong to the store
 * the state names; then the code becomes saved access, the catalog is found or made, and the
 * first sync is queued. The merchant lands back on the channel's page either way.
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
  const back = new URL(page, req.nextUrl.origin)
  const done = (result: string) => {
    back.searchParams.set('connect', result)
    return NextResponse.redirect(back)
  }
  if ((provider !== 'meta' && provider !== 'google') || !s) return done('failed')
  if (!code) return done('cancelled')
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL(routes.login(), req.nextUrl.origin))
  const member = await withStore(db(), s.storeId, (tx) =>
    memberAccess(tx, s.storeId, session.user.id),
  )
  if (!member) return done('failed')
  try {
    const r = await completeChannelConnect(db(), { provider, code, state: raw }, deps)
    await queueChannelSync(channelSyncQueue(loadEnv(process.env).REDIS_URL), r.storeId, r.channel)
    return done('connected')
  } catch {
    return done('failed')
  }
}
