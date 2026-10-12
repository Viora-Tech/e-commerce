import 'server-only'
import { appRouter, createRequestMemo, remember } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import {
  aiBulkQueue,
  appEventQueue,
  appJobQueue,
  dailyVisitors,
  liveVisitors,
  mediaProcessQueue,
  notificationQueue,
  purchaseDocumentQueue,
  sharedRedis,
  storeExportQueue,
} from '@commerce/queue'
import { call } from '@orpc/server'
import { headers } from 'next/headers'
import { cache } from 'react'
import { auth, getSession } from './auth'
import { db } from './db'
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
    storeExport: storeExportQueue(loadEnv(process.env).REDIS_URL),
    aiBulk: aiBulkQueue(loadEnv(process.env).REDIS_URL),
    purchaseDocuments: purchaseDocumentQueue(loadEnv(process.env).REDIS_URL),
    visitors: {
      live: (storeId: string) => liveVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId),
      daily: (storeId: string, days: string[]) =>
        dailyVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, days),
    },
    rateLimit: createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL)),
    reportError,
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
  return { ...apiHost(), headers: await headers(), memo }
})

export { appRouter, call }
