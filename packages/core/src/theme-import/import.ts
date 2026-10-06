/** SOURCE OF TRUTH: importing a Shopify theme — WHAT: zip → a NEW unpublished theme "<name> (imported)": its files stored, its Shopify-hosted images copied into Files (SSRF-safe), the home page and header/footer groups turned into `LiquidSection` templates, and the import report / WHY: merchants moving from Shopify keep their look; nothing touches the live theme, and the report says in plain words what now runs on our features */

import { createHash } from 'node:crypto'
import { newId, type StoreTx, theme, themeFile, themeImport, themeTemplate } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { eq, sql } from 'drizzle-orm'
import type { LookupAll } from '../net/safe-fetch'
import { MAX_THEMES, ThemeLibraryError } from '../theme/library'
import { defaultTheme, parseTheme } from '../theme/schema'
import type { TemplateData, TemplateKey } from '../theme/templates-data'
import { archiveText, readThemeArchive, type ThemeArchive, ThemeArchiveProblem } from './archive'
import {
  LIQUID_SECTION,
  type LiquidBlockItem,
  liquidSectionId,
  schemaText,
  settingsToProps,
} from './fields'
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
  SHOP_IMAGE,
  SHOP_VIDEO,
  takeMedia,
} from './import-media'
import { buildReport, collectHandles, missingHandles, type Wanted } from './import-report'
import { IMPORTED_TEMPLATES, type ImportReport } from './report'
import {
  extractSchema,
  parseJsonTemplate,
  parseThemeJson,
  type ShopifyJsonTemplate,
  type ShopifySectionSchema,
  type ShopifySetting,
} from './schema'
import { shopifyUrlToPath } from './settings-values'

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
 * A stored setting value: image settings become `{ url, alt }` pointing at Files,
 * Shopify resource links become our paths. Product, collection and menu settings keep
 * their handles (ours match, since the catalogue import keeps Shopify's handles).
 */
function storedValue(setting: ShopifySetting | undefined, value: unknown, hosted: Hosted): unknown {
  if (typeof value === 'string') {
    const video = SHOP_VIDEO.exec(value)
    if (video?.[1]) {
      const v = hosted.videos.get(video[1])
      return v ? { url: v.url, poster: v.poster } : ''
    }
    const m = SHOP_IMAGE.exec(value)
    if (m?.[1]) {
      const h = hosted.images.get(m[1])
      if (setting && setting.type !== 'image_picker') return h?.url ?? ''
      return h ? { url: h.url, alt: '', width: h.width, height: h.height } : { url: '', alt: '' }
    }
    if (value.startsWith('shopify://')) return shopifyUrlToPath(value)
    if (setting?.type === 'image_picker')
      return value ? { url: value, alt: '' } : { url: '', alt: '' }
  }
  if (setting?.type === 'image_picker' && (value === null || value === undefined)) {
    return { url: '', alt: '' }
  }
  return value
}

function storedSettings(
  schema: ShopifySetting[] | undefined,
  values: Record<string, unknown> | undefined,
  hosted: Hosted,
): Record<string, unknown> {
  const byId = new Map((schema ?? []).flatMap((s) => (s.id ? [[s.id, s] as const] : [])))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values ?? {})) out[k] = storedValue(byId.get(k), v, hosted)
  for (const s of schema ?? []) {
    if (s.id && s.type === 'image_picker' && !(s.id in out)) out[s.id] = { url: '', alt: '' }
  }
  return out
}

/** One JSON template (or group) as our template data. */
function toTemplateData(
  tpl: ShopifyJsonTemplate,
  schemas: Map<string, ShopifySectionSchema | null>,
  schemaLocale: Record<string, unknown>,
  hosted: Hosted,
): TemplateData {
  return {
    root: { props: {} },
    content: tpl.order.flatMap((key) => {
      const s = tpl.sections[key]
      if (!s || !schemas.has(s.type)) return []
      const schema = schemas.get(s.type) ?? null
      const order = s.block_order ?? Object.keys(s.blocks ?? {})
      const blocks: LiquidBlockItem[] = order.flatMap((id) => {
        const b = s.blocks?.[id]
        if (!b) return []
        const blockSchema = schema?.blocks?.find((x) => x.type === b.type)
        return [
          {
            id,
            type: b.type,
            ...(b.disabled ? { disabled: true } : {}),
            settings: storedSettings(blockSchema?.settings, b.settings, hosted),
          },
        ]
      })
      return [
        {
          type: LIQUID_SECTION,
          props: {
            id: liquidSectionId(key),
            sectionType: s.type,
            sectionKey: key,
            // Customize shows `_name` as the section's name (merchants can rename it).
            _name: schemaText(schema?.name, schemaLocale) || s.type,
            blocks,
            ...settingsToProps(storedSettings(schema?.settings, s.settings, hosted)),
            ...(s.disabled ? { _hidden: true } : {}),
          },
        },
      ]
    }),
  }
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

/** The templates and groups an import turns into ours. */
const IMPORTED_PAGES = [...IMPORTED_TEMPLATES, 'header-group', 'footer-group']

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

  // Videos need the live home page (see `copyLiveVideos`); read it first, before the image
  // downloads, so Shopify's rate limit is not already spent.
  const videoNames = new Set<string>()
  for (const name of IMPORTED_PAGES) collectShopVideos(templates.get(name), videoNames)
  const settings = currentSettings(archive)
  const wanted = new Set<string>()
  for (const name of IMPORTED_PAGES) {
    collectShopImages(templates.get(name), wanted)
  }
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
    for (const name of IMPORTED_PAGES) {
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
    settings: live ? parseTheme(live.settings) : defaultTheme,
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

  // Home, header and footer as our templates.
  const schemas = new Map([...sections].map(([type, s]) => [type, s.schema]))
  const pages: [TemplateKey, string][] = [
    ['home', 'index'],
    ['header', 'header-group'],
    ['footer', 'footer-group'],
  ]
  for (const [key, source] of pages) {
    const tpl = templates.get(source)
    if (!tpl) continue
    await tx.insert(themeTemplate).values({
      id: newId(),
      storeId,
      themeId,
      template: key,
      suffix: '',
      sections: toTemplateData(tpl, schemas, schemaLocale, hosted),
    })
  }

  const wantedHandles: Wanted = {
    menus: new Set(),
    collections: new Set(),
    products: new Set(),
    blogs: new Set(),
  }
  const videos = new Set<string>()
  for (const [, source] of pages) {
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
