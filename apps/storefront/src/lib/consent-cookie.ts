import 'server-only'
import {
  bannerAsks,
  CONSENT_COOKIE,
  type Consent,
  consentRegion,
  decodeConsent,
  effectiveConsent,
  type PageConsentRegion,
  type StoredConsent,
} from '@commerce/core/consent'
import { cookies, headers } from 'next/headers'
import { visitorCountry } from './routing'
import { storefrontLock } from './storefront-gate'

/**
 * Set by the proxy on a page a shared cache may keep (`lib/edge-cache.ts`): that copy goes to
 * visitors from anywhere, so it is drawn without the region and the browser asks
 * `/api/consent-region`. Derived only by the proxy (`DERIVED_HEADERS`).
 */
export const CONSENT_PENDING_HEADER = 'x-consent-pending'

type HeaderReader = Pick<Headers, 'get'>

/** One request's consent: the region it is in, the saved answer, and what counts. */
export type RequestConsent = {
  region: PageConsentRegion
  stored: StoredConsent | null
  bannerVersion: number
  consent: Consent | null
}

/**
 * How this request is treated, as on Shopify (Settings › Customer privacy): visitors from a
 * region that requires consent (`CONSENT_REQUIRED_COUNTRIES`, by Cloudflare's `CF-IPCountry`), or
 * every visitor when the store asks everyone, get the banner; anyone else is `open`.
 */
export async function requestRegion(storeId: string, h: HeaderReader): Promise<PageConsentRegion> {
  if (h.get(CONSENT_PENDING_HEADER) === '1') return 'pending'
  const lock = await storefrontLock(storeId)
  return consentRegion(lock.bannerRegions, visitorCountry(h))
}

/** The consent that counts for a request, from its headers and the `wc_consent` cookie value. */
export async function consentOf(
  storeId: string,
  h: HeaderReader,
  raw: string | null | undefined,
): Promise<RequestConsent> {
  const [region, lock] = await Promise.all([requestRegion(storeId, h), storefrontLock(storeId)])
  const stored = decodeConsent(raw)
  return {
    region,
    stored,
    bannerVersion: lock.bannerVersion,
    consent: effectiveConsent(stored, lock.bannerVersion, region),
  }
}

/** This request's consent (server components, route handlers, server actions). */
export async function requestConsent(storeId: string): Promise<RequestConsent> {
  const [h, jar] = await Promise.all([headers(), cookies()])
  return consentOf(storeId, h, jar.get(CONSENT_COOKIE)?.value)
}

/** Whether this request may use analytics (the visit beacon, experiments, discovery). */
export async function analyticsAllowed(storeId: string): Promise<boolean> {
  return (await requestConsent(storeId)).consent?.analytics === true
}

/** Whether this request may use marketing (the affiliate referral cookie, the pixels). */
export async function marketingAllowed(storeId: string): Promise<boolean> {
  return (await requestConsent(storeId)).consent?.marketing === true
}

/** The liquid shim's consent fields (`lib/liquid-shim.ts`) for an imported theme's page. */
export function shimConsentOf(
  stored: StoredConsent | null,
  bannerVersion: number,
  region: PageConsentRegion,
): { askConsent: boolean; consentPending: boolean; granted: Consent } {
  const consent = effectiveConsent(stored, bannerVersion, region)
  return {
    askConsent: bannerAsks(stored, bannerVersion, region),
    consentPending: region === 'pending',
    granted: consent ?? { analytics: false, marketing: false },
  }
}
