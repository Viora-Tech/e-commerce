import 'server-only'
import type { PlatformActor } from '@commerce/core'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { appRouter, call, serverContext } from './api'

/**
 * The platform console's page guard (`src/app/(platform)`). It asks the API's own guard
 * (`platform.whoami`: staff email, passkey session, owner connection), so pages and the API
 * can never disagree. Anyone else gets the ordinary 404 page, never a "forbidden" that would
 * tell them the console exists. Every page calls it, the layout too.
 */
export const requirePlatformStaff = cache(async (): Promise<PlatformActor> => {
  try {
    return await call(appRouter.platform.whoami, undefined, { context: await serverContext() })
  } catch {
    notFound()
  }
})

/**
 * One platform read for a server page: the same call the browser would make, with a 404 for
 * anything the guard refuses and the error passed on otherwise.
 */
export async function platformCallOptions() {
  await requirePlatformStaff()
  return { context: await serverContext() }
}
