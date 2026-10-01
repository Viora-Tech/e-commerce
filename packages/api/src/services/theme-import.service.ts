import { loadEnv, settingsSecret } from '@commerce/config'
import {
  createPageContext,
  googleFontsHref,
  importShopifyTheme,
  type LiquidSectionInput,
  loadThemeBundle,
  renderLiquidLayout,
  renderLiquidSection,
  type ShopifySectionSchema,
  sectionWrapper,
  storeLiquidData,
  themeImportFor,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { storeRegistries } from './apps.service'
import { storageProviderFor } from './media.service'

/**
 * Glue between the themes router and `@commerce/core` theme-import: the store's
 * storage for copied images, and the editor canvas's renders (scripts stripped; the
 * canvas shows the look, the storefront runs the behaviour).
 */

const storefront = () => new URL(loadEnv(process.env).STOREFRONT_URL)

/** Imports an uploaded Shopify theme zip as a new unpublished theme. */
export async function importThemeZip(
  tx: StoreTx,
  storeId: string,
  input: { file: File; shopifyHost?: string | undefined },
) {
  const { storage } = await storeRegistries(tx, storeId)
  const provider = await storageProviderFor(tx, storeId, storage, settingsSecret())
  const zip = new Uint8Array(await input.file.arrayBuffer())
  return importShopifyTheme(
    tx,
    storeId,
    { zip, fileName: input.file.name, shopifyHost: input.shopifyHost },
    { storage: provider },
  )
}

/** The import report page's data. */
export async function themeImportReport(tx: StoreTx, themeId: string) {
  const record = await themeImportFor(tx, themeId)
  if (!record) return null
  return {
    fileName: record.fileName,
    themeInfo: record.themeInfo,
    report: record.report,
    importedAt: record.createdAt,
  }
}

/** Script tags never run in the editor canvas (it shares the admin's origin). */
const stripScripts = (html: string) =>
  html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')

async function editorContext(tx: StoreTx, storeId: string, themeId: string) {
  const bundle = await loadThemeBundle(tx, themeId)
  if (!bundle) return null
  const record = await themeImportFor(tx, themeId)
  const url = storefront()
  return createPageContext({
    bundle,
    data: await storeLiquidData(tx, { storeId, host: url.host, origin: url.origin }),
    request: {
      template: 'index',
      path: '/',
      host: url.host,
      origin: url.origin,
      designMode: true,
      postedForm: null,
      nonce: '',
    },
    assetBase: `${url.origin}/theme-assets/${themeId}`,
    shopifyHost: record?.themeInfo.shopifyHost ?? null,
    moneyFormat: null,
    paymentTypes: ['visa', 'master', 'rupay', 'upi'],
  })
}

/**
 * What Customize needs for an imported theme: section schemas (fields are generated
 * from them), the schema locale for labels, and the theme's head (stylesheets, CSS
 * variables, fonts) for the canvas. Null for our own themes.
 */
export async function liquidEditorInfo(tx: StoreTx, storeId: string, themeId: string) {
  const ctx = await editorContext(tx, storeId, themeId)
  if (!ctx) return null
  const layout = await renderLiquidLayout(ctx)
  const schemas: Record<string, ShopifySectionSchema> = {}
  for (const [type, s] of ctx.bundle.sections) if (s.schema) schemas[type] = s.schema
  const blockSchemas: Record<string, ShopifySectionSchema> = {}
  for (const [type, s] of ctx.bundle.blocks) if (s.schema) blockSchemas[type] = s.schema
  return {
    schemas,
    blockSchemas,
    schemaLocale: ctx.bundle.schemaLocale,
    head: stripScripts(layout.head),
    beforeHeader: stripScripts(layout.beforeHeader),
    fontsHref: googleFontsHref(layout.fonts),
    htmlAttrs: layout.htmlAttrs,
  }
}

/** Renders sections for the canvas, keyed by section id, each inside Shopify's wrapper. */
export async function renderLiquidForEditor(
  tx: StoreTx,
  storeId: string,
  themeId: string,
  sections: LiquidSectionInput[],
): Promise<Record<string, string>> {
  const ctx = await editorContext(tx, storeId, themeId)
  if (!ctx) return {}
  const out: Record<string, string> = {}
  for (const section of sections) {
    const html = await renderLiquidSection(ctx, section)
    const w = sectionWrapper(ctx.bundle, section)
    out[section.id] = `<${w.tag} id="${w.id}" class="${w.className}">${stripScripts(html)}</${w.tag}>`
  }
  return out
}
