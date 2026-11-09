/** SOURCE OF TRUTH: importing a Shopify theme — WHAT: zip → a NEW unpublished theme "<name> (imported)": its files stored, its Shopify-hosted images copied into Files (SSRF-safe), the home page, the product, collection and page templates (with alternates; our own main section in place of the theme's) and the header/footer groups turned into `LiquidSection` templates, and the import report / WHY: merchants moving from Shopify keep their look; nothing touches the live theme, and the report says in plain words what now runs on our features */

import { createHash } from 'node:crypto'
import { withImportedDefaults } from '@commerce/blocks/imported-defaults'
import { newId, type StoreTx, theme, themeFile, themeImport, themeTemplate } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { eq, sql } from 'drizzle-orm'
import type { LookupAll } from '../net/safe-fetch'
import { MAX_THEMES, ThemeLibraryError } from '../theme/library'
import { defaultTheme, parseTheme } from '../theme/schema'
import {
  defaultTemplate,
  MAIN_SECTION,
  TEMPLATE_SUFFIX,
  type TemplateData,
  type TemplateKey,
  type TemplateSection,
} from '../theme/templates-data'
import { withOwnThemePacks } from '../theme/theme-packs'
import { archiveText, readThemeArchive, type ThemeArchive, ThemeArchiveProblem } from './archive'
import { LIQUID_SECTION, liquidSectionId, schemaText, settingsToProps } from './fields'
import {
  collectShopImages,
  collectShopVideos,
  connectedShopifyHost,
  copyImage,
  copyLiveVideos,
  findImportedMedia,
  type Hosted,
  inBatches,
  livePage,
  newMediaBudget,
  takeMedia,
} from './import-media'
import { buildReport, collectHandles, missingHandles, type Wanted } from './import-report'
import { themeMainProps } from './main-collection-props'
import { type ImportReport, isMainSection } from './report'
import {
  extractSchema,
  parseJsonTemplate,
  parseThemeJson,
  type ShopifyJsonTemplate,
  type ShopifySectionSchema,
  type ShopifySetting,
} from './schema'
import { storedSettings, templateBlocks } from './stored-settings'
import { type ThemeLook, themeLook } from './theme-look'

export class ThemeImportError extends ThemeLibraryError {}

export type ThemeImportInput = {
  zip: Uint8Array
  fileName: string
  /** The store's Shopify address (`waimers.in` or `x.myshopify.com`), to copy its images. */
  shopifyHost?: string | null | undefined
}

export type ThemeImportDeps = {
  storage: StorageProvider
  /** Tests inject these; production uses the real network through `safeFetch`. */
  fetch?: typeof fetch | undefined
  lookup?: LookupAll | undefined
  /** Image dimensions for copied images (sharp in production). */
  imageSize?: ((bytes: Uint8Array) => Promise<{ width: number; height: number } | null>) | undefined
  /**
   * Queues a copied image's media row for the upload pipeline (sized AVIF/WebP copies). Without
   * it the row is stored `ready` with no copies, which `bun run media:reprocess` picks up later.
   */
  processImage?: ((mediaId: string) => Promise<void>) | undefined
}

export type ThemeImportResult = { themeId: string; name: string; report: ImportReport }

/** `waimers.in`, `https://waimers.in/` and `x.myshopify.com` all become a bare host. */
export function cleanShopifyHost(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return null
  const host = value.replace(/^https?:\/\//, '').split(/[/?#]/)[0] ?? ''
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

const checksum = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 16)

/**
 * Our own main section for a resource template (`MainProduct`…), as a fresh template starts
 * it. A theme's main section (`main-product`, Dawn's `main-collection-banner` +
 * `main-collection-product-grid`…) draws the part shoppers act on, which runs on ours. It
 * opens with the imported-theme defaults written out (our product-page extras off, #1049), so
 * Customize shows each switch as it renders.
 */
function ourMainSection(key: TemplateKey): TemplateSection | null {
  const type = (MAIN_SECTION as Partial<Record<string, string>>)[key]
  if (!type) return null
  const main = defaultTemplate(key).content.find((s) => s.type === type)
  return main ? withImportedDefaults(main) : null
}

/**
 * One JSON template (or group) as our template data. In a resource template (product,
 * collection, blog, article, 404) the theme's first main section becomes ours and any further one is
 * dropped (ours covers it); every other section stays the theme's own. A product or
 * collection template with no main section gets ours first. A page template keeps the theme's
 * own main section: it only reads `page.title` / `page.content`, which Liquid has, and a page
 * alternate's main is often the page itself (a wishlist grid, a styled title with breadcrumbs).
 */
function toTemplateData(
  tpl: ShopifyJsonTemplate,
  schemas: Map<string, ShopifySectionSchema | null>,
  schemaLocale: Record<string, unknown>,
  hosted: Hosted,
  key: TemplateKey,
  theme: { look: ThemeLook; settings: Record<string, unknown> },
): TemplateData {
  const main = key === 'page' ? null : ourMainSection(key)
  let mainPlaced = false
  // Ours opens with what the theme's main section(s) were set to show.
  const stored = (type: string, values: Record<string, unknown> | undefined) =>
    storedSettings(schemas.get(type)?.settings, values, hosted)
  const fromTheme = (s: ShopifyJsonTemplate['sections'][string]) =>
    themeMainProps(key, tpl, s, stored, {
      ...theme,
      blocksOf: (section) => templateBlocks(section, schemas.get(section.type) ?? null, hosted, 0),
    })
  const content = tpl.order.flatMap((sectionKey): TemplateSection[] => {
    const s = tpl.sections[sectionKey]
    if (!s) return []
    if (main && isMainSection(s.type)) {
      if (mainPlaced) return []
      mainPlaced = true
      return [
        {
          ...main,
          props: { ...main.props, ...fromTheme(s), ...(s.disabled ? { _hidden: true } : {}) },
        },
      ]
    }
    if (!schemas.has(s.type)) return []
    const schema = schemas.get(s.type) ?? null
    const blocks = templateBlocks(s, schema, hosted, 0)
    return [
      {
        type: LIQUID_SECTION,
        props: {
          id: liquidSectionId(sectionKey),
          sectionType: s.type,
          sectionKey,
          // Customize shows `_name` as the section's name (merchants can rename it).
          _name: schemaText(schema?.name, schemaLocale) || s.type,
          blocks,
          ...settingsToProps(storedSettings(schema?.settings, s.settings, hosted)),
          ...(s.disabled ? { _hidden: true } : {}),
        },
      },
    ]
  })
  // A product or collection page without the part shoppers buy from would be a dead end:
  // when the theme's template has no main section, ours opens the page. Pages may go without.
  if (main && !mainPlaced && (key === 'product' || key === 'collection')) content.unshift(main)
  return { root: { props: {} }, content }
}

/** `config/settings_data.json`'s current settings (a preset name or the object itself). */
function currentSettings(archive: ThemeArchive): Record<string, unknown> {
  const text = archiveText(archive, 'config/settings_data.json')
  const data = text
    ? parseThemeJson<{ current?: unknown; presets?: Record<string, unknown> }>(text)
    : null
  const current = data?.current
  if (typeof current === 'string')
    return (data?.presets?.[current] as Record<string, unknown>) ?? {}
  return current && typeof current === 'object' ? (current as Record<string, unknown>) : {}
}

/** Shopify resource templates turned into ours, by the base of their name. */
const RESOURCE_TEMPLATES: Record<string, TemplateKey> = {
  product: 'product',
  collection: 'collection',
  page: 'page',
  blog: 'blog',
  article: 'article',
  // The not-found page: its main section becomes ours, the theme's other sections stay around it.
  '404': 'not_found',
}

/**
 * The theme's templates and groups an import turns into ours, as `[our key, suffix, Shopify
 * name]`: the home page, the header and footer groups, the 404 page, and the product,
 * collection, page, blog and article templates with their alternates (`page.about` → page `about`). An alternate whose name our
 * templates cannot hold is left out (its pages run on the default template).
 */
export function importedPages(names: Iterable<string>): [TemplateKey, string, string][] {
  const out: [TemplateKey, string, string][] = [
    ['home', '', 'index'],
    ['header', '', 'header-group'],
    ['footer', '', 'footer-group'],
  ]
  for (const name of [...names].sort()) {
    const [base = '', ...rest] = name.split('.')
    const key = RESOURCE_TEMPLATES[base]
    const suffix = rest.join('.')
    if (!key || !TEMPLATE_SUFFIX.test(suffix)) continue
    out.push([key, suffix, name])
  }
  return out
}

/** `theme_info` from settings_schema.json. */
function themeInfoOf(archive: ThemeArchive, fileName: string) {
  const schema = parseThemeJson<
    { name?: string; theme_name?: string; theme_version?: string; theme_author?: string }[]
  >(archiveText(archive, 'config/settings_schema.json') ?? '[]')
  const info = schema?.find((g) => g.name === 'theme_info')
  const base = fileName
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return {
    name: (info?.theme_name ?? base) || 'Shopify theme',
    version: info?.theme_version ?? '',
    author: info?.theme_author ?? '',
  }
}

/**
 * Imports a Shopify theme zip as a NEW unpublished theme. The live theme is never
 * touched. Throws `ThemeImportError` with a message for the merchant.
 */
export async function importShopifyTheme(
  tx: StoreTx,
  storeId: string,
  input: ThemeImportInput,
  deps: ThemeImportDeps,
): Promise<ThemeImportResult> {
  let archive: ThemeArchive
  try {
    archive = readThemeArchive(input.zip)
  } catch (err) {
    if (err instanceof ThemeArchiveProblem)
      throw new ThemeImportError('THEME_IMPORT_INVALID', err.message)
    throw err
  }
  const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(theme)
  if (n >= MAX_THEMES) {
    throw new ThemeImportError(
      'THEME_LIMIT',
      `You can keep ${MAX_THEMES} themes. Delete one to import another.`,
    )
  }

  // The typed address wins; otherwise the store's connected Shopify importer.
  const host =
    cleanShopifyHost(input.shopifyHost) ?? cleanShopifyHost(await connectedShopifyHost(tx))
  const schemaLocale =
    [...archive.files.keys()]
      .filter((p) => p.startsWith('locales/') && p.endsWith('.default.schema.json'))
      .map(
        (p) => parseThemeJson<Record<string, unknown>>(archiveText(archive, p) ?? '') ?? {},
      )[0] ?? {}

  // Sections and their schemas; JSON templates and groups.
  const sections = new Map<string, { raw: string; schema: ShopifySectionSchema | null }>()
  const templates = new Map<string, ShopifyJsonTemplate>()
  const liquidTemplates: string[] = []
  for (const path of archive.files.keys()) {
    const text = archiveText(archive, path)
    if (text === null) continue
    const section = /^sections\/([^/]+)\.liquid$/.exec(path)?.[1]
    if (section) sections.set(section, { raw: text, schema: extractSchema(text) })
    const group = /^sections\/([^/]+-group)\.json$/.exec(path)?.[1]
    const tplName = /^templates\/(.+)\.json$/.exec(path)?.[1]
    const name = group ?? tplName
    if (name) {
      const parsed = parseJsonTemplate(text)
      if (parsed) templates.set(name, parsed)
    }
    const liquidTpl = /^templates\/(.+)\.liquid$/.exec(path)?.[1]
    if (liquidTpl) liquidTemplates.push(liquidTpl)
  }

  // The templates and groups that become ours, and their Shopify names.
  const pages = importedPages(templates.keys())
  const importedNames = pages.map(([, , name]) => name)

  // Videos need the live home page (see `copyLiveVideos`); read it first, before the image
  // downloads, so Shopify's rate limit is not already spent.
  const videoNames = new Set<string>()
  for (const name of importedNames) collectShopVideos(templates.get(name), videoNames)
  const settings = currentSettings(archive)
  const wanted = new Set<string>()
  for (const name of importedNames) collectShopImages(templates.get(name), wanted)
  collectShopImages(settings, wanted)

  // Files the Shopify importer already copied are reused, so only what is missing is downloaded.
  const hosted = await findImportedMedia(tx, wanted, videoNames)
  const failed: string[] = []
  const missingImages = [...wanted].filter((n) => !hosted.images.has(n))
  const homePage =
    host && [...videoNames].some((n) => !hosted.videos.has(n))
      ? await livePage(host, '/', deps)
      : null

  // Images the theme's templates and settings point at, copied from the old store.
  const budget = newMediaBudget()
  if (host) {
    await inBatches(missingImages, 6, async (name) => {
      const refused = takeMedia(budget, 'images')
      if (refused) {
        failed.push(`${name}: ${refused}`)
        return
      }
      try {
        hosted.images.set(name, await copyImage(tx, storeId, host, name, deps))
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  // Videos in Shopify Files have no address we can derive from their name; the live
  // store's own pages carry them, so they are matched there, section by section.
  if (homePage && 'problem' in homePage) {
    failed.push(`videos: could not read https://${host}/ (${homePage.problem})`)
  } else if (homePage) {
    for (const name of importedNames) {
      const tpl = templates.get(name)
      if (tpl) await copyLiveVideos(tx, storeId, homePage.html, tpl, hosted, failed, deps, budget)
    }
  }

  // The theme row: unpublished, keeping the live theme's brand settings for our own pages.
  const info = themeInfoOf(archive, input.fileName)
  const [live] = await tx
    .select({ settings: theme.settings })
    .from(theme)
    .where(eq(theme.role, 'main'))
  const themeId = newId()
  const name = `${info.name} (imported)`.slice(0, 50)
  await tx.insert(theme).values({
    id: themeId,
    storeId,
    name,
    role: 'unpublished',
    preset: null,
    // Its own section packs: none (a pack's sections are ours, not the imported theme's).
    settings: withOwnThemePacks(live ? parseTheme(live.settings) : defaultTheme, []),
  })

  // Files, exactly as uploaded.
  const rows = [...archive.files.values()].map((f) => ({
    id: newId(),
    storeId,
    themeId,
    path: f.path,
    body: f.text ? new TextDecoder().decode(f.bytes) : Buffer.from(f.bytes).toString('base64'),
    encoding: f.text ? 'utf8' : 'base64',
    contentType: f.contentType,
    size: f.bytes.byteLength,
    checksum: checksum(f.bytes),
  }))
  for (let i = 0; i < rows.length; i += 100)
    await tx.insert(themeFile).values(rows.slice(i, i + 100))

  // Theme settings typed by settings_schema.json, images pointed at Files.
  const settingsSchema = (
    parseThemeJson<{ settings?: ShopifySetting[] }[]>(
      archiveText(archive, 'config/settings_schema.json') ?? '[]',
    ) ?? []
  ).flatMap((g) => g.settings ?? [])
  const themeSettings = storedSettings(settingsSchema, settings, hosted)
  for (const [k, v] of Object.entries(settings)) if (!(k in themeSettings)) themeSettings[k] = v

  // Home, header, footer, product, collection and page templates (with alternates) as ours.
  const schemas = new Map([...sections].map(([type, s]) => [type, s.schema]))
  // Titles in capitals, trust badges grid, filled Add to cart: the theme's CSS and markup.
  const look = themeLook(archive)
  for (const [key, suffix, source] of pages) {
    const tpl = templates.get(source)
    if (!tpl) continue
    await tx.insert(themeTemplate).values({
      id: newId(),
      storeId,
      themeId,
      template: key,
      suffix,
      sections: toTemplateData(tpl, schemas, schemaLocale, hosted, key, { look, settings }),
    })
  }

  const wantedHandles: Wanted = {
    menus: new Set(),
    collections: new Set(),
    products: new Set(),
    blogs: new Set(),
  }
  const videos = new Set<string>()
  for (const source of importedNames) {
    collectHandles(templates.get(source), schemas, wantedHandles)
    collectShopVideos(templates.get(source), videos)
  }
  const report = buildReport({
    sections,
    templates,
    liquidTemplates,
    schemaLocale,
    themeInfo: info,
    images: {
      copied: hosted.images.size,
      videosCopied: hosted.videos.size,
      failed,
      skippedNoHost: host ? 0 : missingImages.length,
    },
    skippedFiles: archive.skipped,
    missing: await missingHandles(tx, wantedHandles),
    // Videos still to upload: the ones the live page did not give us.
    videos: [...videos].filter((v) => !hosted.videos.has(v)).sort(),
  })
  await tx.insert(themeImport).values({
    id: newId(),
    storeId,
    themeId,
    source: 'shopify',
    fileName: input.fileName.slice(0, 200),
    themeInfo: { ...info, shopifyHost: host },
    settings: themeSettings,
    report,
  })
  return { themeId, name, report }
}
