import 'server-only'
import { appRouter } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import {
  appEventQueue,
  appJobQueue,
  dailyVisitors,
  liveVisitors,
  notificationQueue,
  sharedRedis,
} from '@commerce/queue'
import { call } from '@orpc/server'
import { headers } from 'next/headers'
import { auth } from './auth'
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
    visitors: {
      live: (storeId: string) => liveVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId),
      daily: (storeId: string, days: string[]) =>
        dailyVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, days),
    },
    rateLimit: createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL)),
    reportError,
  }
}

/** Server-side calls into the router with the current request's session. */
export async function serverContext() {
  return { ...apiHost(), headers: await headers() }
}

export { appRouter, call }
