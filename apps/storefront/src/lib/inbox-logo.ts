import 'server-only'
import {
  liquidThemeLogoUrl,
  loadTemplate,
  mainThemeId,
  parseCheckoutSettings,
} from '@commerce/core'
import { importedTheme } from './liquid-theme'
import { storeRead } from './store-cache'

type ChatLogoInput = {
  storeId: string
  /** The theme this request renders; null when the store has none yet. */
  themeId: string | null
  /** The theme is an imported Shopify (Liquid) theme. */
  liquid: boolean
  /** `theme.brand.logo`, set on our own themes. */
  themeLogo: string | null | undefined
  /** `store.preferences`: Settings › Checkout › Branding keeps a logo too. */
  preferences: unknown
  /** `theme.brand.favicon`. */
  favicon: string | null | undefined
}

/** The header logo an imported theme keeps in its own settings (header section or settings_data). */
async function liquidLogo(storeId: string, themeId: string): Promise<string | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return null
  // The same cache entry the header render reads (`template-render.tsx`).
  const header = await storeRead(storeId, `template|${themeId}|header|`, (tx) =>
    loadTemplate(tx, themeId, 'header', ''),
  )
  const content = Array.isArray(header.data.content) ? header.data.content : []
  return liquidThemeLogoUrl(
    content as { type: string; props: Record<string, unknown> }[],
    theme.bundle,
  )
}

/** The live theme's own header logo when it is an imported Shopify theme, else null. */
export async function liveLiquidLogoUrl(storeId: string): Promise<string | null> {
  // The same cache entry the layout reads (`liveThemeId` in template-render).
  const themeId = await storeRead(storeId, 'main-theme', (tx) => mainThemeId(tx))
  return themeId ? liquidLogo(storeId, themeId) : null
}

/**
 * The picture for the Inbox chat header's avatar: an imported theme's own header logo, our
 * theme's brand logo, the checkout branding logo, then the favicon. Null leaves the store's
 * first letter.
 */
export async function chatLogoUrl(input: ChatLogoInput): Promise<string | null> {
  const fromLiquid =
    input.liquid && input.themeId ? await liquidLogo(input.storeId, input.themeId) : null
  return (
    fromLiquid ??
    input.themeLogo ??
    parseCheckoutSettings(input.preferences).branding.logo?.url ??
    input.favicon ??
    null
  )
}
