import { loadEnv } from '@commerce/config'

let cached: string | null = null

/** The platform login domain's origin, e.g. `https://accounts.waimers.store` (`ACCOUNTS_URL`). */
export function accountsOrigin(): string {
  if (!cached) {
    const env = loadEnv(process.env)
    cached = new URL(env.ACCOUNTS_URL ?? `https://accounts.${env.PLATFORM_STORE_DOMAIN}`).origin
  }
  return cached
}

/** Its hostname, which the proxy answers as the login domain rather than a store. */
export function accountsHostname(): string {
  return new URL(accountsOrigin()).hostname
}
