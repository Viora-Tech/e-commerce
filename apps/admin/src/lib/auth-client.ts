'use client'

import { createMerchantAuthClient } from '@commerce/auth/client'

export const authClient = createMerchantAuthClient('')

/** Better Auth's client errors carry a `code` only on some paths ("AUTH_CANCELLED"). */
export function authErrorCode(error: object): string {
  return 'code' in error && typeof error.code === 'string' ? error.code : ''
}
