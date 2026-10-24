/**
 * The cookie that holds a Shopify install started while signed out (the sealed access from
 * `sealInstallGrant`) until the merchant signs in and the claim route connects it. Scoped to the
 * importer's API routes, http-only, 30 minutes.
 */
export const INSTALL_GRANT_COOKIE = 'shopify_install_grant'
export const INSTALL_GRANT_PATH = '/api/apps/shopify-import'
