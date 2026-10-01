'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import { verifyThemePreviewToken } from '@commerce/core'
import { headers } from 'next/headers'

/**
 * Whether a theme preview token was signed by this deployment's admin for the store this
 * hostname serves and has not expired. The storefront only accepts unsaved theme overrides
 * over postMessage after this answers true.
 */
export async function verifyThemePreview(token: string): Promise<boolean> {
  if (typeof token !== 'string' || token.length > 200) return false
  const storeId = (await headers()).get('x-store-id')
  if (!storeId) return false
  const secret = settingsSecret()
  if (!secret) return false
  return verifyThemePreviewToken({ secret, storeId, token })
}
