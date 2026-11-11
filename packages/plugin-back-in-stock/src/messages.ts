import { product, type StoreTx, variant } from '@commerce/db'
import type { TemplateData } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { backInStockSignup } from './schema'

/**
 * What the two shopper messages carry: the confirm link sent right after an email signup
 * (double opt-in) and the restock alert. Every link opens a storefront route on the store's
 * own domain (`apps/storefront/src/app/api/back-in-stock/...`), and every message carries
 * the signup's unsubscribe link.
 */

/** Storefront route folders (under `src/app`), each with a `[token]/route.ts`. */
export const BACK_IN_STOCK_CONFIRM_PATH = 'api/back-in-stock/confirm'
export const BACK_IN_STOCK_UNSUBSCRIBE_PATH = 'api/back-in-stock/unsubscribe'

const base = (origin: string) => origin.replace(/\/+$/, '')

const confirmUrl = (origin: string, token: string) =>
  `${base(origin)}/${BACK_IN_STOCK_CONFIRM_PATH}/${encodeURIComponent(token)}`

const unsubscribeUrl = (origin: string, token: string) =>
  `${base(origin)}/${BACK_IN_STOCK_UNSUBSCRIBE_PATH}/${encodeURIComponent(token)}`

const STOP_LABEL = 'Stop these alerts'

/** A variant called "Default" is the product itself: no variant title in the message. */
const variantTitleOf = (title: string | null | undefined) =>
  title && title !== 'Default' ? title : undefined

export type BackInStockMessageData = Pick<TemplateData, 'backInStock' | 'links'>

/**
 * The confirm message for a signup still waiting for it, or null (confirmed, unsubscribed,
 * gone, or a WhatsApp signup, which needs no confirm). The store name is added by the sender.
 */
export async function confirmMessageFor(
  tx: StoreTx,
  signupId: string,
  origin: string,
): Promise<{ email: string; data: BackInStockMessageData } | null> {
  const [row] = await tx
    .select({
      email: backInStockSignup.email,
      status: backInStockSignup.status,
      confirmToken: backInStockSignup.confirmToken,
      unsubscribeToken: backInStockSignup.unsubscribeToken,
      productTitle: product.title,
      variantTitle: variant.title,
    })
    .from(backInStockSignup)
    .innerJoin(variant, eq(variant.id, backInStockSignup.variantId))
    .innerJoin(product, eq(product.id, backInStockSignup.productId))
    .where(eq(backInStockSignup.id, signupId))
  if (!row?.email || !row.confirmToken || row.status !== 'pending_confirmation') return null
  const stop = unsubscribeUrl(origin, row.unsubscribeToken)
  return {
    email: row.email,
    data: {
      backInStock: {
        productTitle: row.productTitle,
        variantTitle: variantTitleOf(row.variantTitle),
        confirmUrl: confirmUrl(origin, row.confirmToken),
        unsubscribeUrl: stop,
      },
      links: [{ label: STOP_LABEL, url: stop }],
    },
  }
}

/** The restock alert's data: the store's name, the product page and the unsubscribe link. */
export function alertMessageData(input: {
  storeName: string
  origin: string
  productTitle: string
  productHandle: string
  variantTitle: string | null | undefined
  unsubscribeToken: string
}): Pick<TemplateData, 'storeName' | 'backInStock' | 'links'> {
  const stop = unsubscribeUrl(input.origin, input.unsubscribeToken)
  return {
    storeName: input.storeName,
    backInStock: {
      productTitle: input.productTitle,
      variantTitle: variantTitleOf(input.variantTitle),
      productUrl: `${base(input.origin)}/products/${encodeURIComponent(input.productHandle)}`,
      unsubscribeUrl: stop,
    },
    links: [{ label: STOP_LABEL, url: stop }],
  }
}
