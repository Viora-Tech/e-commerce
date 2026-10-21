import type { StoreTx } from '@commerce/db'
import { payment, storeDomain } from '@commerce/db'
import { isWebsiteNotRegistered } from '@commerce/payments/failure-reasons'
import { RAZORPAY_UPI_ID } from '@commerce/payments-razorpay'
import { and, asc, desc, eq, gte, ilike, inArray } from 'drizzle-orm'

/** How far back a "website not registered" failure keeps the warning on Settings → Payments. */
const WEBSITE_BLOCK_LOOKBACK_MS = 7 * 24 * 60 * 60_000

/** `localhost` and `*.localhost`: a development address Razorpay never sees. */
const LOCAL = /(^|\.)localhost$/

/**
 * Every address the storefront and its checkout are served from: the platform subdomain
 * (`waimers.koomerce.app`) and each connected custom domain that is live, primary first.
 * Razorpay blocks a live payment whose website is not listed on the merchant's account,
 * and has no API to add one, so the admin lists them for the merchant to add by hand.
 */
export async function razorpayWebsites(tx: StoreTx, storeId: string): Promise<string[]> {
  const rows = await tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(and(eq(storeDomain.storeId, storeId), eq(storeDomain.status, 'active')))
    .orderBy(desc(storeDomain.isPrimary), desc(storeDomain.kind), asc(storeDomain.createdAt))
  return [...new Set(rows.map((r) => r.hostname.toLowerCase()))].filter((h) => !LOCAL.test(h))
}

export type WebsiteBlock = {
  /** When the latest blocked payment was tried. */
  at: string
  orderId: string
  /** Razorpay's words, as stored on the attempt. */
  error: string
}

/**
 * The latest Razorpay payment in the last 7 days that Razorpay refused because the website
 * it came from is not registered on the merchant's account, or null when there is none.
 */
export async function latestRazorpayWebsiteBlock(
  tx: StoreTx,
  storeId: string,
  now: Date = new Date(),
): Promise<WebsiteBlock | null> {
  const rows = await tx
    .select({ at: payment.createdAt, orderId: payment.orderId, error: payment.error })
    .from(payment)
    .where(
      and(
        eq(payment.storeId, storeId),
        inArray(payment.provider, ['razorpay', RAZORPAY_UPI_ID]),
        eq(payment.status, 'failed'),
        gte(payment.createdAt, new Date(now.getTime() - WEBSITE_BLOCK_LOOKBACK_MS)),
        ilike(payment.error, '%website%'),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(20)
  const hit = rows.find((r) => isWebsiteNotRegistered(r.error))
  return hit ? { at: hit.at.toISOString(), orderId: hit.orderId, error: hit.error ?? '' } : null
}
