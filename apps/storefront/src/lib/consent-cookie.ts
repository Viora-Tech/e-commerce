import { decodeConsent } from '@commerce/core/preferences'

/**
 * Whether the consent cookie says yes to analytics. Used where the store's
 * banner version is not at hand (the proxy, the beacon): the banner itself
 * only renders the beacon for a choice made on the current version.
 */
export function analyticsAllowed(raw: string | undefined): boolean {
  return decodeConsent(raw)?.analytics === true
}
