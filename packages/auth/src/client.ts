import { passkeyClient } from '@better-auth/passkey/client'
import { emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export function createMerchantAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [emailOTPClient(), organizationClient(), passkeyClient()],
  })
}

export type MerchantAuthClient = ReturnType<typeof createMerchantAuthClient>
