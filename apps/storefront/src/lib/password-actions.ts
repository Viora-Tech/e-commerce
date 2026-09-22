'use server'

import { checkStorefrontPassword, parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { inStore } from './store-context'
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken } from './storefront-gate'

export type UnlockState = { error: boolean }

/**
 * The password page's form. The store comes from the proxy's derived header, never
 * from the form, so a visitor can only try the store they are on.
 */
export async function unlockStorefront(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const storeId = (await headers()).get('x-store-id')
  const given = form.get('password')
  if (!storeId || typeof given !== 'string' || given.length > 200) return { error: true }

  const prefs = await inStore(storeId, async (tx) => {
    const [row] = await tx
      .select({ preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    return parsePreferences(row?.preferences)
  })
  if (!checkStorefrontPassword(prefs.password.password, given)) return { error: true }

  const proto = (await headers()).get('x-forwarded-proto')
  ;(await cookies()).set(ACCESS_COOKIE, accessToken(storeId, prefs.password.password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: proto === 'https',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  })
  redirect('/')
}
