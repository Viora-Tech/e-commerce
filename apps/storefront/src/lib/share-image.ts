import { liveThemeSettings, parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { liveLiquidLogoUrl } from './inbox-logo'
import { storeRead } from './store-cache'

export type ShareImage = { url: string; alt: string }

/** Link previews need about this width. Originals can be megabytes, too big for some apps. */
const SHARE_WIDTH = 1200

/** The image for a link preview: the variant nearest `SHARE_WIDTH`, else the original. */
export function shareImageUrl(image: {
  url: string
  variants?: Record<string, { webp: string }> | null | undefined
}): string {
  const variants = image.variants ?? {}
  const widths = Object.keys(variants)
    .map(Number)
    .sort((a, b) => a - b)
  const width = widths.filter((w) => w <= SHARE_WIDTH).at(-1) ?? widths[0]
  return (width !== undefined && variants[String(width)]?.webp) || image.url
}

/** The merchant's share image, else the logo. */
export function pickShareImage(
  seo: { image: { url: string } | null; imageAlt: string; title: string },
  logoUrl: string | null | undefined,
  storeName: string,
): ShareImage[] | undefined {
  if (seo.image) return [{ url: seo.image.url, alt: seo.imageAlt || seo.title || storeName }]
  return logoUrl ? [{ url: logoUrl, alt: storeName }] : undefined
}

/**
 * The store's fallback link preview. A page's `openGraph` replaces the layout's whole, so a page
 * with no image of its own has to pass this or its link shows no picture.
 */
export async function storeShareImages(storeId: string): Promise<ShareImage[] | undefined> {
  // An imported theme keeps its logo in its header, not in our brand settings.
  const liquidLogo = await liveLiquidLogoUrl(storeId)
  return storeRead(storeId, `share-images|${liquidLogo ?? ''}`, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    if (!s) return undefined
    const logo = liquidLogo ?? (await liveThemeSettings(tx, storeId)).brand.logo?.url
    return pickShareImage(parsePreferences(s.preferences).seo, logo, s.name)
  })
}
