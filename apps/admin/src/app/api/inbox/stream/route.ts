import { loadEnv } from '@commerce/config'
import {
  inboxChannels,
  inboxStreamResponse,
  pollInstead,
  replayForStore,
} from '@commerce/core/inbox/server'
import { inboxHub } from '@commerce/queue'
import { ORPCError } from '@orpc/server'
import { appRouter, call, serverContext } from '@/lib/api'
import { db } from '@/lib/db'
import { withEvlog } from '@/lib/request-log'

/** Redis unreachable or misconfigured: the stream answers "poll" instead. */
function hubOrNull() {
  try {
    return inboxHub(loadEnv(process.env).REDIS_URL)
  } catch {
    return null
  }
}

/**
 * The admin Inbox's live stream (Server-Sent Events): everything on the store's channel for a
 * member who may read Inbox. On reconnect the browser sends `Last-Event-ID` and the missed
 * messages come from Postgres first (one short query; no connection is held while the stream
 * is open). 503 means "poll `inbox.sync` instead" (design 2026-10-24-inbox §4).
 */
export const GET = withEvlog(async (request: Request) => {
  let storeId: string
  try {
    const context = await serverContext()
    storeId = (await call(appRouter.inbox.streamAccess, undefined, { context })).storeId
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      return new Response('Unauthorized', { status: 401 })
    }
    if (error instanceof ORPCError && error.code === 'FORBIDDEN') {
      return new Response('Forbidden', { status: 403 })
    }
    return pollInstead()
  }
  const url = new URL(request.url)
  return inboxStreamResponse({
    hub: hubOrNull(),
    channels: [inboxChannels.store(storeId)],
    lastEventId: request.headers.get('last-event-id') ?? url.searchParams.get('after'),
    replay: (floorId) => replayForStore(db(), storeId, floorId),
    signal: request.signal,
  })
})
