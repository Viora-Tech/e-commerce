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
  inboxPublisher,
  liveVisitors,
  mediaProcessQueue,
  notificationQueue,
  purchaseDocumentQueue,
  queueHealth,
  sharedRedis,
  storeExportQueue,
} from '@commerce/queue'
import { call } from '@orpc/server'
import { headers } from 'next/headers'
import { cache } from 'react'
import { auth, getSession } from './auth'
import { db, ownerDb } from './db'
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
    channelSync: channelSyncQueue(loadEnv(process.env).REDIS_URL),
    automationSteps: automationStepQueue(loadEnv(process.env).REDIS_URL),
    visitors: {
      live: (storeId: string) => liveVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId),
      daily: (storeId: string, days: string[]) =>
        dailyVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, days),
    },
    rateLimit: createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL)),
    inboxPublisher: inboxPublisher(loadEnv(process.env).REDIS_URL),
    reportError,
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

export { appRouter, call }
