'use server'

import { loadEnv } from '@commerce/config'
import { verifyThemePreviewToken } from '@commerce/core'

/**
 * Whether a theme preview token was signed by this deployment's admin for this
 * store and has not expired. The storefront only accepts unsaved theme overrides
 * over postMessage after this answers true.
 */
export async function verifyThemePreview(storeId: string, token: string): Promise<boolean> {
  if (typeof storeId !== 'string' || typeof token !== 'string' || token.length > 200) return false
  const secret = loadEnv(process.env).SETTINGS_SECRET
  if (!secret) return false
  return verifyThemePreviewToken({ secret, storeId, token })
}
