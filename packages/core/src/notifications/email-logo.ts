/** SOURCE OF TRUTH: the logo at the top of a store's emails — WHAT: an imported (Liquid) theme's own header logo, else our theme's brand logo, else the checkout branding logo, made absolute / WHY: an imported Shopify theme keeps its logo in its own settings, not in `theme.brand`, so a store on one (Waimers' revamp theme) sent every email without a logo; mail clients also cannot load a relative `/…` path */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { parseCheckoutSettings } from '../checkout/settings'
import { loadTemplate, mainThemeId } from '../theme/templates'
import { loadThemeBundle } from '../theme-import/bundle-store'
import { liquidThemeLogoUrl } from '../theme-import/logo'

/**
 * A URL a mail client can load: absolute http(s) as is, protocol-relative as https, a site path
 * on the shop's domain. Anything else (a `shopify://` reference, a bare file name) is null.
 */
function emailImageUrl(url: string | null | undefined, shopUrl: string | null): string | null {
  const u = url?.trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/') && shopUrl) return `${shopUrl.replace(/\/+$/, '')}${u}`
  return null
}

/** The live imported theme's header logo, or null when the live theme is one of ours. */
async function liquidLogo(tx: StoreTx): Promise<string | null> {
  const themeId = await mainThemeId(tx)
  if (!themeId) return null
  const bundle = await loadThemeBundle(tx, themeId)
  if (!bundle) return null
  const header = await loadTemplate(tx, themeId, 'header', '')
  const content = Array.isArray(header.data.content) ? header.data.content : []
  return liquidThemeLogoUrl(content as { type: string; props: Record<string, unknown> }[], bundle)
}

/** The store's email logo as an absolute URL, or null (the email then shows the store name). */
export async function storeEmailLogo(
  tx: StoreTx,
  storeId: string,
  themeLogo: string | null | undefined,
  shopUrl: string | null,
): Promise<string | null> {
  // An imported theme's own logo first: its `theme.brand` is only what the import left there.
  const imported = emailImageUrl(await liquidLogo(tx), shopUrl)
  if (imported) return imported
  const own = emailImageUrl(themeLogo, shopUrl)
  if (own) return own
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return emailImageUrl(parseCheckoutSettings(s?.preferences).branding.logo?.url, shopUrl)
}
