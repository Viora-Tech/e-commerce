import { appRouter } from '@commerce/api'
import { loadEnv } from '@commerce/config'
import { liveVisitors, notificationQueue, sharedRedis } from '@commerce/queue'
import { call } from '@orpc/server'
import { headers } from 'next/headers'
import { auth } from './auth'
import { db } from './db'

/** Everything the router needs from this host, minus the request headers. */
export function apiHost() {
  return {
    db: db(),
    auth: auth(),
    notifications: notificationQueue(loadEnv(process.env).REDIS_URL),
    visitors: {
      live: (storeId: string) => liveVisitors(sharedRedis(loadEnv(process.env).REDIS_URL), storeId),
    },
  }
}

/** Server-side calls into the router with the current request's session. */
export async function serverContext() {
  return { ...apiHost(), headers: await headers() }
}

export { appRouter, call }
