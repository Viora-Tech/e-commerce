import 'server-only'

import { loadEnv } from '@commerce/config'
import {
  liveThemeSettings,
  readStoreProfile,
  storeCheckoutLook,
  storefrontOriginFor,
} from '@commerce/core'
import {
  type AffiliateRow,
  affiliateForCustomer,
  affiliateState,
} from '@commerce/plugin-affiliates/server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { withThemeLogo } from './checkout-look'
import { currentCustomer } from './customer-session'
import { PORTAL_BASE_HEADER, PORTAL_PATH } from './portal-routing'
import { storeRead } from './store-cache'
import { inStore } from './store-context'

/*
 * What every page of the affiliate portal (`app/-f`) needs: where its links start, the store's
 * name, logo and support email, and who is signed in. The store is the proxy's; the affiliate is
 * always the signed-in shopper's own record.
 */

/** `''` on `affiliate.<domain>`, `/affiliate` on the store's own domains. */
export async function portalBase(): Promise<string> {
  return (await headers()).get(PORTAL_BASE_HEADER) ?? PORTAL_PATH
}

/** A portal page's URL from its base: `portalHref('', '/')` → `/`, `('/affiliate', '/payouts')`. */
export function portalHref(base: string, path: string): string {
  if (path === '/' || path === '') return base || '/'
  return `${base}${path}`
}

export type PortalStore = {
  name: string
  logoUrl: string | null
  logoDarkUrl: string | null
  /** The theme's favicon: a square mark for the sidebar and sign-in tiles (a wide logo is not). */
  iconUrl: string | null
  /** The checkout brand colour (`#6c3baa`), the portal's primary; null keeps shadcn's neutral. */
  brand: string | null
  /** Settings › Store details contact email, for the top bar's "Support". */
  email: string | null
  /** The store's own address (its live primary domain), where referral links point. */
  origin: string
}

/** The store's name, logo, support email and origin, cached per store version. */
export const portalStore = cache(async (storeId: string): Promise<PortalStore> => {
  const fallback = loadEnv(process.env).STOREFRONT_URL ?? 'http://localhost:3100'
  const read = await storeRead(storeId, 'affiliate-portal-store', async (tx) => {
    const [look, profile, origin, theme] = await Promise.all([
      storeCheckoutLook({ tx, storeId }),
      readStoreProfile({ tx, storeId }),
      storefrontOriginFor(tx, storeId, fallback),
      liveThemeSettings(tx, storeId),
    ])
    const accent = look.branding.accent
    return {
      look,
      email: profile.contactEmail || null,
      origin,
      iconUrl: theme.brand.favicon?.url ?? null,
      brand: typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
    }
  })
  const look = await withThemeLogo(storeId, read.look)
  return {
    name: look.storeName,
    logoUrl: look.logoUrl,
    logoDarkUrl: look.logoDarkUrl ?? null,
    iconUrl: read.iconUrl,
    brand: read.brand,
    email: read.email,
    origin: read.origin,
  }
})

export type PortalViewer = {
  me: Awaited<ReturnType<typeof currentCustomer>>
  /** Their affiliate record, if they have one. */
  affiliate: AffiliateRow | null
}

/** Who is signed in and their affiliate record; not found when the store has no Affiliates app. */
export const portalViewer = cache(async (storeId: string): Promise<PortalViewer> => {
  const me = await currentCustomer(storeId)
  const result = await inStore(storeId, async (tx) => {
    const { installed } = await affiliateState(tx, storeId)
    if (!installed) return null
    return { affiliate: me ? await affiliateForCustomer(tx, storeId, me.id) : null }
  })
  if (!result) notFound()
  return { me, affiliate: result.affiliate }
})

/**
 * An approved affiliate's portal page. Signed out → sign in; signed in without an approved
 * record → the signup page, which shows the form or where their application stands.
 */
export async function requireAffiliate(storeId: string): Promise<{
  me: NonNullable<PortalViewer['me']>
  affiliate: AffiliateRow
  base: string
}> {
  const base = await portalBase()
  const { me, affiliate } = await portalViewer(storeId)
  if (!me) redirect(portalHref(base, '/sign-in'))
  if (affiliate?.status !== 'approved') redirect(portalHref(base, '/signup'))
  return { me, affiliate, base }
}
