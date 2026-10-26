'use server'

import 'server-only'

import { readStoreProfile, storeCheckoutLook } from '@commerce/core'
import { checkoutBrandingVars } from '@commerce/core/checkout-settings'
import { headers } from 'next/headers'
import { storeRead } from './store-cache'

/** What an error page shows of the store: its brand, its checkout colours and a way to reach it. */
export type ErrorHelp = {
  storeName: string
  logoUrl: string | null
  /** `wa.me` link from the store's contact number, when it has one. */
  whatsapp: string | null
  /** `mailto:` link from the store's contact email, when it has one. */
  email: string | null
  /** Settings › Checkout › Branding as --ck-* properties (`checkoutBrandingVars`). */
  vars: Record<string, string>
}

/** A 10-digit number is Indian; anything longer already carries its country code. */
function whatsappLink(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  if (digits.length < 10) return null
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`
}

/**
 * The store's name, logo, checkout colours and contact links for the error pages (`error.tsx`,
 * `global-error.tsx`), which are client components with no layout data of their own. The store
 * is the proxy's (`x-store-id`); the read is cached per store version, so a page that keeps
 * failing does not add database load. Null when there is no store or the read fails too (the
 * database being down is a likely reason the page failed): the page then shows without them.
 */
export async function errorHelpAction(): Promise<ErrorHelp | null> {
  const storeId = (await headers()).get('x-store-id')
  if (!storeId) return null
  try {
    return await storeRead(storeId, 'error-help', async (tx) => {
      const look = await storeCheckoutLook({ tx, storeId })
      const { contactEmail } = await readStoreProfile({ tx, storeId })
      return {
        storeName: look.storeName,
        logoUrl: look.logoUrl,
        whatsapp: whatsappLink(look.contactPhone),
        email: contactEmail ? `mailto:${contactEmail}` : null,
        vars: checkoutBrandingVars(look.branding),
      }
    })
  } catch {
    return null
  }
}
