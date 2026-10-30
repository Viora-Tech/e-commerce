import 'server-only'
import { Reveal, sectionExperimentGate } from '@commerce/blocks'
import { createBlocksConfig, type PageData, type SectionMetadata } from '@commerce/blocks/puck'
import { renderBlock } from '@commerce/blocks/slots'
import {
  applyBindings,
  applyLoops,
  boundLoops,
  boundPaths,
  defaultTemplate,
  isSectionHidden,
  loadLoopValues,
  loadSourceValues,
  loadTemplate,
  mainThemeId,
  recentVisibleArticles,
  type TemplateKey,
  toCardArticle,
  versionTemplate,
} from '@commerce/core'
import { preorderBlocks } from '@commerce/core/preorder-block'
import { appBlockSourcesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { type Assignments, variantMatches } from '@commerce/plugin-growthbook/assign'
import { reviewsState, storeWidgetReviews } from '@commerce/plugin-reviews/server'
import type { ComponentConfig } from '@puckeditor/core'
import { resolveAllData } from '@puckeditor/core'
import { headers } from 'next/headers'
import { Fragment, Suspense } from 'react'
import ExperimentBeacon from '@/components/analytics/experiment-beacon'
import RecentlyViewed from '@/components/product/recently-viewed'
import DeferredLiquid from '@/components/theme/deferred-liquid'
import LiquidHtml from '@/components/theme/liquid-html'
import { listCardProducts } from './catalog'
import { collectionCards, listCollections } from './collections'
import { requestExperiments } from './experiments'
import { digest } from './liquid-cache'
import { liquidSplit, STREAM_GRACE_MS, settlesWithin } from './liquid-split'
import { renderLiquidSections } from './liquid-theme'
import { attachImageMedia } from './media-lookup'
import { subscribeAction } from './newsletter-actions'
import { storeRead } from './store-cache'
import { inStore } from './store-context'
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
  /** The product being viewed, for the product page sections (tabs, specs, size guide...). */
  product?: SectionMetadata['product']
  /** Actions bound to `product` (the sticky add-to-cart bar's add to cart). */
  productActions?: SectionMetadata['productActions']
  /** The page's own product or collection, for settings connected to its dynamic sources. */
  sources?: { productId?: string | undefined; collectionId?: string | undefined }
  /** Told which section types this request draws (hidden ones left out), before they render. */
  onSections?: ((types: ReadonlySet<string>) => void) | undefined
  /** Imported sections' markup rides in the RSC payload, for a render the browser draws (`LiquidHtml`). */
  inlineLiquid?: boolean | undefined
}

/** Whether this request is a verified theme preview (Customize, or the Preview button). */
export async function isThemePreview(storeId: string): Promise<boolean> {
  return readPreview(storeId, (await headers()).get('x-theme-preview')) !== null
}

/** The live theme's id, cached per store version. */
export function liveThemeId(storeId: string): Promise<string | null> {
  return storeRead(storeId, 'main-theme', (tx) => mainThemeId(tx))
}

/** Which theme this request renders, and whether it is the Customize preview. */
async function requestTheme(storeId: string) {
  const all = await headers()
  const preview = readPreview(storeId, all.get('x-theme-preview'))
  return {
    themeId: preview?.themeId ?? (await liveThemeId(storeId)),
    preview: Boolean(preview),
    /** A version from the theme's history to show instead (preview only, set by the proxy). */
    version: preview ? all.get('x-theme-version') : null,
  }
}

/**
 * Store reads for one template render: cached per store version, except in a theme preview,
 * which shows drafts and must read everything as it is now.
 */
function readerFor(storeId: string, preview: boolean) {
  return <T,>(key: string, read: (tx: StoreTx) => Promise<T>): Promise<T> =>
    preview ? inStore(storeId, read) : storeRead(storeId, key, read)
}

async function blocksConfig(storeId: string, read: ReturnType<typeof readerFor>) {
  // Plugin manifests hold React components: charge the budget a nominal size, never walk them.
  const { allSources, enabledIds } = await storeRead(
    storeId,
    'app-block-sources',
    (tx) => appBlockSourcesForStore(tx, storeId),
    { size: 4096 },
  )
  // The core plugin's manifest leaves its block unattached (see core-plugin.ts) so
  // @commerce/blocks stays out of every other consumer's compile graph; the storefront
  // route is where a real React tree is already in play, so it fills the gap here.
  const sources = allSources.map((s) => (s.id === 'core' ? { ...s, blocks: preorderBlocks } : s))
  return createBlocksConfig(
    ({ productType, collectionHandle, limit }) =>
      collectionHandle
        ? read(`collection-cards|${collectionHandle}|${limit}`, (tx) =>
            collectionCards(tx, collectionHandle, limit),
          )
        : read(`card-products|${limit}|${productType ?? ''}`, (tx) =>
            listCardProducts(tx, limit, productType),
          ),
    {
      loadArticles: (query) =>
        read(`articles|${digest(query)}`, async (tx) =>
          (await recentVisibleArticles(tx, query)).map(toCardArticle),
        ),
      loadCollections: async (handles) => {
        const all = await read('collections', (tx) => listCollections(tx))
        return handles.flatMap((h) => all.filter((c) => c.handle === h))
      },
      loadProduct: (handle) =>
        read(
          `card-product|${handle}`,
          async (tx) => (await listCardProducts(tx, 1, undefined, [handle]))[0] ?? null,
        ),
      // The Reviews app's sections: published reviews only, null without the app.
      loadReviews: (query) =>
        read(`widget-reviews|${digest(query)}`, async (tx) => {
          const state = await reviewsState(tx, storeId)
          return state.installed ? storeWidgetReviews(tx, state.settings, query) : null
        }),
    },
    sources,
    enabledIds,
  )
}

/**
 * The top-level sections this shopper sees of an A/B test (a section's "A/B test" setting, the
 * GrowthBook app), and the experiments those sections belong to, for the "experiment viewed"
 * beacon. Sections for another variant are left out before anything renders or loads.
 */
function experimentSections<T extends { props: Record<string, unknown> }>(
  content: T[],
  assignments: Assignments,
): { content: T[]; seen: string[] } {
  const seen = new Set<string>()
  const shown = content.filter((section) => {
    const gate = sectionExperimentGate(section.props)
    if (!gate) return true
    if (Object.hasOwn(assignments, gate.key)) seen.add(gate.key)
    return variantMatches(gate, assignments)
  })
  return { content: shown, seen: [...seen] }
}

/**
 * Renders a theme template (or the header or footer group) for this request: the
 * live theme's saved sections, or in the Customize preview the previewed theme
 * with its unsaved drafts. Hidden sections are skipped. Opens its own short transactions, and
 * only for what the store cache does not already hold: call it outside `inStore`.
 */
export async function renderTemplate(
  storeId: string,
  key: TemplateKey,
  options: TemplateOptions = {},
) {
  const { themeId, preview, version } = await requestTheme(storeId)
  const read = readerFor(storeId, preview)
  const suffix = (preview && options.view) || options.suffix || ''
  const versioned =
    themeId && version
      ? await inStore(storeId, (tx) =>
          versionTemplate(tx, { themeId, batchId: version, template: key, suffix }),
        )
      : null
  const data =
    versioned ??
    (themeId
      ? (
          await read(`template|${themeId}|${key}|${suffix}`, (tx) =>
            loadTemplate(tx, themeId, key, suffix, { withDraft: preview }),
          )
        ).data
      : defaultTemplate(key))
  // A theme preview shows every variant's sections, so the merchant can edit them all.
  const experiments = preview ? null : await requestExperiments(storeId)
  const tested = experiments
    ? experimentSections(
        data.content.filter((s) => !isSectionHidden(s)),
        experiments.assignments,
      )
    : { content: data.content.filter((s) => !isSectionHidden(s)), seen: [] }
  const visibleSections = { ...data, content: tested.content }
  // Lists bound to store data (FAQ items from a content type, a collection's products) fill
  // their rows now, capped and under this store's RLS; an empty list shows the typed-in rows.
  const loops = boundLoops(visibleSections)
  const shown = loops.length
    ? applyLoops(
        visibleSections,
        await read(`loops|${digest(loops)}`, (tx) =>
          loadLoopValues(tx, loops, {
            collectionProducts: (handle, limit) => collectionCards(tx, handle, limit),
          }),
        ),
      )
    : visibleSections
  // Connected settings read their source now, under this store's RLS; an empty source renders
  // what the merchant typed in.
  const paths = boundPaths(shown)
  const sources = { storeId, ...options.sources }
  const bound = paths.length
    ? applyBindings(
        shown,
        await read(`sources|${digest([paths, options.sources ?? {}])}`, (tx) =>
          loadSourceValues(tx, paths, sources),
        ),
      )
    : shown
  // Section images are saved as bare URLs; one lookup gives <Picture> their AVIF/WebP
  // variants and ThumbHash, so a banner never ships the full-size original.
  const visible = await attachImageMedia(storeId, bound, preview)
  const config = await blocksConfig(storeId, read)
  // An imported Shopify theme: its sections come from the render cache or the Liquid engine
  // now; the LiquidSection renderer below only places the HTML. Past the split, the rest are
  // rendered after the first ones and stream in (`DeferredLiquid`).
  const split = await liquidSplit(key, preview)
  const liquidHtml = themeId
    ? await renderLiquidSections(storeId, themeId, key, visible.content, {
        ...split,
        end: split.streamFrom,
      })
    : null
  const laterHtml =
    themeId && liquidHtml && visible.content.length > split.streamFrom
      ? renderLiquidSections(storeId, themeId, key, visible.content, {
          ...split,
          start: split.streamFrom,
        })
      : null
  // Awaited by the streamed sections; never an unhandled rejection if none of them renders.
  laterHtml?.catch(() => undefined)
  // Sections the render cache already holds come back at once: streaming them would gain
  // nothing, so they are drawn in place. Only a slow render (a cache miss) streams.
  const inPlace = laterHtml !== null && (await settlesWithin(laterHtml, STREAM_GRACE_MS))
  if (inPlace) for (const [id, html] of (await laterHtml) ?? []) liquidHtml?.set(id, html)
  const streamed = inPlace ? null : laterHtml
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
      LiquidSection: (settings) => {
        const id = String(settings.id)
        const section = liquidHtml?.get(id)
        if (section) return <LiquidHtml {...section} inline={options.inlineLiquid} />
        return streamed ? (
          <DeferredLiquid sections={streamed} id={id} inline={options.inlineLiquid} />
        ) : null
      },
      ...options.renderers,
    },
    appBlockContext: options.appBlockContext,
    product: options.product,
    productActions: options.productActions,
    newsletterAction: subscribeAction,
  }
  const resolved = await resolveAllData(visible as unknown as PageData, config, metadata)
  // Imported sections also report their theme type (`LiquidSection:cookie-banner`).
  options.onSections?.(
    new Set(
      resolved.content.flatMap((item) =>
        item.type === 'LiquidSection'
          ? [String(item.type), `LiquidSection:${String(item.props.sectionType)}`]
          : [String(item.type)],
      ),
    ),
  )
  const components = config.components as unknown as Record<string, ComponentConfig | undefined>
  const puck = { metadata, isEditing: false, renderDropZone: () => null, dragRef: null }
  // Sections below the first rise in on scroll. Not the header and footer groups, and
  // not in a theme preview, where the merchant is looking at sections, not arriving.
  const reveals = !preview && liquidHtml === null && key !== 'header' && key !== 'footer'
  // The first section of a page is where the LCP image usually is: hero-type blocks
  // load theirs eagerly at high priority when told so, everything else stays lazy.
  const group = key === 'header' || key === 'footer'

  const sections = resolved.content.map((item, index) => {
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
  })
  // Past the split, one boundary: its sections arrive later in the same response.
  const streamFrom = streamed ? split.streamFrom : sections.length

  return (
    <>
      {tested.seen.length ? <ExperimentBeacon seen={tested.seen} /> : null}
      {sections.slice(0, streamFrom)}
      {streamFrom < sections.length ? (
        <Suspense fallback={null}>{sections.slice(streamFrom)}</Suspense>
      ) : null}
    </>
  )
}
