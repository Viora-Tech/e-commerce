/** SOURCE OF TRUTH: store links origin — WHAT: `https://<live primary domain>` for every store-facing link, STOREFRONT_URL only as the fallback / WHY: one storefront serves every store by hostname, so the platform URL reaches no store ("No store is configured for ...") */
import { type StoreTx, storeDomain } from '@commerce/db'
import { and, eq } from 'drizzle-orm'

/** `localhost` and `*.localhost`: a development storefront, never a real store domain. */
const LOCAL = /(^|\.)localhost$/

/**
 * The origin a store's links go to, from its primary hostname. One storefront app serves
 * every store by hostname, so a link on the platform's own `STOREFRONT_URL` reaches no
 * store at all ("No store is configured for ..."). `fallback` (that env URL) is used only
 * when the store has no active primary domain, or in development, where the fallback is a
 * localhost URL and the store's domains do not point at this machine.
 */
export function storefrontOrigin(primaryHostname: string | null, fallback: string): string {
  const base = new URL(fallback)
  if (!primaryHostname || LOCAL.test(base.hostname)) return base.origin
  return `https://${primaryHostname}`
}

/**
 * `https://<subdomain>.<primary hostname>` — a store's branded, theme-free checkout origin
 * (security audit D-01, phase B). Falls back to the store origin (`storefrontOrigin`) when the
 * subdomain is unset (the `CHECKOUT_SUBDOMAIN` flag is off), when the store has no primary
 * hostname, or in development (a localhost fallback is never branded). The caller still decides,
 * per store, whether the branded host is actually provisioned; this only computes the origin.
 */
export function checkoutOrigin(
  primaryHostname: string | null,
  subdomain: string | null,
  fallback: string,
): string {
  if (!subdomain || !primaryHostname || LOCAL.test(new URL(fallback).hostname)) {
    return storefrontOrigin(primaryHostname, fallback)
  }
  return `https://${subdomain}.${primaryHostname}`
}

/** `checkoutOrigin` for a store, resolving its live primary hostname the same way as `storefrontOriginFor`. */
export async function checkoutOriginFor(
  tx: StoreTx,
  storeId: string,
  subdomain: string | null,
  fallback: string,
): Promise<string> {
  return checkoutOrigin(await primaryStoreHostname(tx, storeId), subdomain, fallback)
}

/** The store's primary domain when it is live (`is_primary AND status = 'active'`), else null. */
async function primaryStoreHostname(tx: StoreTx, storeId: string): Promise<string | null> {
  const [row] = await tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(
      and(
        eq(storeDomain.storeId, storeId),
        eq(storeDomain.isPrimary, true),
        eq(storeDomain.status, 'active'),
      ),
    )
  return row?.hostname ?? null
}

/**
 * `https://<primary active hostname>` for every store-facing link (admin "View store",
 * previews, emails, payment test links), falling back to `fallback` (`STOREFRONT_URL`).
 * No trailing slash.
 */
export async function storefrontOriginFor(
  tx: StoreTx,
  storeId: string,
  fallback: string,
): Promise<string> {
  return storefrontOrigin(await primaryStoreHostname(tx, storeId), fallback)
}
