import { appRouter } from '@commerce/api'
import { call } from '@orpc/server'
import { headers } from 'next/headers'
import { auth } from './auth'
import { db } from './db'

/** Server-side calls into the router with the current request's session. */
export async function serverContext() {
  return { db: db(), auth: auth(), headers: await headers() }
}

export { appRouter, call }
