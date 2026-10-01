import { Reveal } from '@commerce/blocks'
import { createBlocksConfig, type PageData, type SectionMetadata } from '@commerce/blocks/puck'
import { renderBlock } from '@commerce/blocks/slots'
import {
  applyBindings,
  boundPaths,
  defaultTemplate,
  isSectionHidden,
  loadSourceValues,
  loadTemplate,
  mainThemeId,
  recentVisibleArticles,
  type TemplateKey,
  toCardArticle,
} from '@commerce/core'
import { preorderBlocks } from '@commerce/core/preorder-block'
import { appBlockSourcesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import type { ComponentConfig } from '@puckeditor/core'
import { resolveAllData } from '@puckeditor/core'
import { headers } from 'next/headers'
import { Fragment } from 'react'
import RecentlyViewed from '@/components/product/recently-viewed'
import { listCardProducts } from './catalog'
import { collectionCards, listCollections } from './collections'
import { attachImageMedia } from './media-lookup'
import { subscribeAction } from './newsletter-actions'
import { readPreview } from './storefront-gate'

export type TemplateOptions = {
  /** The resource's assigned alternate (`product.template_suffix`); blank for the default. */
  suffix?: string | null | undefined
  /** `?view=` from the Customize preview, which wins over `suffix` while previewing. */
  view?: string | undefined
  /** Renderers for the dynamic sections this route can fill (its main section, header, ...). */
  renderers?: SectionMetadata['renderers']
  /** Data and bound actions app blocks need beyond their own settings (a product, a subscribe action). */
  appBlockContext?: SectionMetadata['appBlockContext']
  /** The page's own product or collection, for settings connected to its dynamic sources. */
  sources?: { productId?: string | undefined; collectionId?: string | undefined }
}

/** Whether this request is a verified theme preview (Customize, or the Preview button). */
export async function isThemePreview(storeId: string): Promise<boolean> {
  return readPreview(storeId, (await headers()).get('x-theme-preview')) !== null
}

/** Which theme this request renders, and whether it is the Customize preview. */
async function requestTheme(tx: StoreTx, storeId: string) {
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  return {
    themeId: preview?.themeId ?? (await mainThemeId(tx)),
    preview: Boolean(preview),
  }
}

async function blocksConfig(tx: StoreTx, storeId: string) {
  const { allSources, enabledIds } = await appBlockSourcesForStore(tx, storeId)
  // The core plugin's manifest leaves its block unattached (see core-plugin.ts) so
  // @commerce/blocks stays out of every other consumer's compile graph; the storefront
  // route is where a real React tree is already in play, so it fills the gap here.
  const sources = allSources.map((s) => (s.id === 'core' ? { ...s, blocks: preorderBlocks } : s))
  return createBlocksConfig(
    ({ productType, collectionHandle, limit }) =>
      collectionHandle
        ? collectionCards(tx, collectionHandle, limit)
        : listCardProducts(tx, limit, productType),
    {
      loadArticles: async (query) => (await recentVisibleArticles(tx, query)).map(toCardArticle),
      loadCollections: async (handles) => {
        const all = await listCollections(tx)
        return handles.flatMap((h) => all.filter((c) => c.handle === h))
      },
      loadProduct: async (handle) =>
        (await listCardProducts(tx, 1, undefined, [handle]))[0] ?? null,
    },
    sources,
    enabledIds,
  )
}

/**
 * Renders a theme template (or the header or footer group) for this request: the
 * live theme's saved sections, or in the Customize preview the previewed theme
 * with its unsaved drafts. Hidden sections are skipped.
 */
export async function renderTemplate(
  tx: StoreTx,
  storeId: string,
  key: TemplateKey,
  options: TemplateOptions = {},
) {
  const { themeId, preview } = await requestTheme(tx, storeId)
  const suffix = (preview && options.view) || options.suffix || ''
  const data = themeId
    ? (await loadTemplate(tx, themeId, key, suffix, { withDraft: preview })).data
    : defaultTemplate(key)
  const shown = { ...data, content: data.content.filter((s) => !isSectionHidden(s)) }
  // Connected settings read their source now, per request and under this store's RLS;
  // an empty source renders what the merchant typed in.
  const paths = boundPaths(shown)
  const bound = paths.length
    ? applyBindings(shown, await loadSourceValues(tx, paths, { storeId, ...options.sources }))
    : shown
  // Section images are saved as bare URLs; one lookup gives <Picture> their AVIF/WebP
  // variants and ThumbHash, so a banner never ships the full-size original.
  const visible = await attachImageMedia(tx, bound)
  const config = await blocksConfig(tx, storeId)
  const metadata: SectionMetadata = {
    renderers: {
      // Any template can show the shopper's history; routes add their own sections.
      RecentlyViewed: (settings) => (
        <RecentlyViewed
          storeId={storeId}
          heading={typeof settings.heading === 'string' ? settings.heading : ''}
          limit={typeof settings.limit === 'number' ? settings.limit : 4}
        />
      ),
      ...options.renderers,
    },
    appBlockContext: options.appBlockContext,
    newsletterAction: subscribeAction,
  }
  const resolved = await resolveAllData(visible as unknown as PageData, config, metadata)
  const components = config.components as unknown as Record<string, ComponentConfig | undefined>
  const puck = { metadata, isEditing: false, renderDropZone: () => null, dragRef: null }
  // Sections below the first rise in on scroll. Not the header and footer groups, and
  // not in a theme preview, where the merchant is looking at sections, not arriving.
  const reveals = !preview && key !== 'header' && key !== 'footer'
  // The first section of a page is where the LCP image usually is: hero-type blocks
  // load theirs eagerly at high priority when told so, everything else stays lazy.
  const group = key === 'header' || key === 'footer'

  return (
    <>
      {resolved.content.map((item, index) => {
        // Slots (Group, Columns, Tabs … and anything nested in them) are drawn here on
        // the server too: renderBlock fills each slot prop with its children. The first
        // top-level section is flagged above the fold so its image loads with priority.
        const aboveFold = index === 0 && !group ? { _aboveFold: true } : {}
        const section = renderBlock(
          { ...item, props: { ...item.props, ...aboveFold } },
          components,
          puck,
        )
        if (!section) return null
        return (
          <Fragment key={item.props.id}>
            {reveals && index > 0 ? <Reveal>{section}</Reveal> : section}
          </Fragment>
        )
      })}
    </>
  )
}
