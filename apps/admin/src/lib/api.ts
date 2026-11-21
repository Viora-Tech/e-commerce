import 'server-only'
import { appRouter, createRequestMemo, remember } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import {
  aiBulkQueue,
  appEventQueue,
  appJobQueue,
  automationStepQueue,
  channelSyncQueue,
  dailyVisitors,
  deliveryQuoteCache,
  inboxPublisher,
  liveVisitors,
  mediaProcessQueue,
  mediaVideoQueue,
  notificationQueue,
  purchaseDocumentQueue,
  pushQueue,
  queueHealth,
  sharedRedis,
  storeExportQueue,
  themeScreenshotQueue,
} from '@commerce/queue'
import { ORPCError, call as orpcCall } from '@orpc/server'
import { headers } from 'next/headers'
import { cache } from 'react'
import { auth, getSession } from './auth'
import { db, ownerDb } from './db'
import { FORBIDDEN_DIGEST } from './forbidden'
import { reportError } from './sentry-report'

/** Everything the router needs from this host, minus the request headers. */
export function apiHost() {
  return {
    db: db(),
    auth: auth(),
    notifications: notificationQueue(loadEnv(process.env).REDIS_URL),
    appEvents: appEventQueue(loadEnv(process.env).REDIS_URL),
    appJobs: appJobQueue(loadEnv(process.env).REDIS_URL),
    mediaProcess: mediaProcessQueue(loadEnv(process.env).REDIS_URL),
    mediaVideo: mediaVideoQueue(loadEnv(process.env).REDIS_URL),
    storeExport: storeExportQueue(loadEnv(process.env).REDIS_URL),
    themeScreenshots: themeScreenshotQueue(loadEnv(process.env).REDIS_URL),
    aiBulk: aiBulkQueue(loadEnv(process.env).REDIS_URL),
    purchaseDocuments: purchaseDocumentQueue(loadEnv(process.env).REDIS_URL),
    channelSync: channelSyncQueue(loadEnv(process.env).REDIS_URL),
    automationSteps: automationStepQueue(loadEnv(process.env).REDIS_URL),
    push: pushQueue(loadEnv(process.env).REDIS_URL),
    visitors: {
      live: (storeId: string) => liveVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId),
      daily: (storeId: string, days: string[]) =>
        dailyVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, days),
    },
    rateLimit: createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL)),
    deliveryHealth: deliveryQuoteCache(sharedRedis(loadEnv(process.env).REDIS_URL)),
    inboxPublisher: inboxPublisher(loadEnv(process.env).REDIS_URL),
    reportError,
    // Step-up re-auth (A5). Off by default; STEP_UP_ENFORCE (validated in `@commerce/config`)
    // turns it on. The passkey rpID/origin is pinned to the admin's own URL, not the request.
    stepUpEnforce: loadEnv(process.env).STEP_UP_ENFORCE,
    appUrl: loadEnv(process.env).ADMIN_URL,
  }
}

/**
 * What only the admin's own cookie routes add (`/api/rpc` and server renders): the platform
 * console's owner connection and worker queue counts. Kept out of `apiHost`, which the
 * bearer-token API and MCP share, so `platform.*` can never be reached from there.
 */
export function platformHost() {
  return {
    platformDb: ownerDb(),
    queueHealth: () => queueHealth(sharedRedis(loadEnv(process.env).REDIS_URL)),
  }
}

/**
 * Server-side calls into the router with the current request's session. One context per
 * server render (React `cache`), so the layout's and the page's calls share one session and
 * membership lookup through its `memo` instead of each repeating them. Outside a render (route
 * handlers, server actions) `cache` does not memoise and every call gets a fresh context.
 */
export const serverContext = cache(async () => {
  const memo = createRequestMemo()
  // The same lookup as `getSession()`, which the layout has already made for this render.
  void remember(memo, 'session', getSession)
  return { ...apiHost(), ...platformHost(), headers: await headers(), memo }
})

/**
 * `call` from oRPC, plus one thing: a FORBIDDEN answer carries a fixed `digest`. Next keeps an
 * error's own digest when it sends a server render's failure to the route's error page (and
 * blanks the message in production), so `RouteError` can say "You do not have access" to a
 * member whose role does not allow the read, instead of "Something went wrong".
 */
const call = (async (...args: unknown[]) => {
  try {
    return await (orpcCall as (...a: unknown[]) => Promise<unknown>)(...args)
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'FORBIDDEN') {
      Object.assign(error, { digest: FORBIDDEN_DIGEST })
    }
    throw error
  }
}) as typeof orpcCall

export { appRouter, call }
