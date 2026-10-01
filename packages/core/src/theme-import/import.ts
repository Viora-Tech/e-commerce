/** SOURCE OF TRUTH: importing a Shopify theme — WHAT: zip → a NEW unpublished theme "<name> (imported)": its files stored, its Shopify-hosted images copied into Files (SSRF-safe), the home page and header/footer groups turned into `LiquidSection` templates, and the import report / WHY: merchants moving from Shopify keep their look; nothing touches the live theme, and the report says in plain words what now runs on our features */
import { createHash } from 'node:crypto'
import {
  blog,
  collection,
  media,
  navigationMenu,
  newId,
  product,
  type StoreTx,
  theme,
  themeFile,
  themeImport,
  themeTemplate,
} from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  type StorageProvider,
  maxUploadBytesFor,
  mediaKey,
} from '@commerce/storage'
import { eq, inArray, sql } from 'drizzle-orm'
import sharp from 'sharp'
import { type LookupAll, readCapped, safeFetch } from '../net/safe-fetch'
import { MAX_THEMES, ThemeLibraryError } from '../theme/library'
import { defaultTheme, parseTheme } from '../theme/schema'
import type { TemplateData, TemplateKey } from '../theme/templates-data'
import { archiveText, readThemeArchive, type ThemeArchive, ThemeArchiveProblem } from './archive'
import { createThemeEngine } from './engine'
import {
  LIQUID_SECTION,
  type LiquidBlockItem,
  liquidSectionId,
  schemaText,
  settingsToProps,
} from './fields'
import { normalizeLiquid, shopifyUrlToPath } from './render'
import {
  countStatuses,
  IMPORTED_TEMPLATES,
  type ImportReport,
  isMainSection,
  type ReportReason,
  type SectionReport,
  statusFor,
  type TemplateReport,
} from './report'
import {
  extractSchema,
  parseJsonTemplate,
  parseThemeJson,
  type ShopifyJsonTemplate,
  type ShopifySectionSchema,
  type ShopifySetting,
  withoutSchema,
} from './schema'
import { type SwapKey, swapsIn } from './swap'

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

const SHOP_IMAGE = /^shopify:\/\/shop_images\/(.+)$/

/** `waimers.in`, `https://waimers.in/` and `x.myshopify.com` all become a bare host. */
export function cleanShopifyHost(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return null
  const host = value.replace(/^https?:\/\//, '').split(/[/?#]/)[0] ?? ''
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

const checksum = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex').slice(0, 16)

/** Every `shopify://shop_images/...` string inside a JSON value. */
function collectShopImages(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const m = SHOP_IMAGE.exec(value)
    if (m?.[1]) into.add(m[1])
  } else if (Array.isArray(value)) for (const v of value) collectShopImages(v, into)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectShopImages(v, into)
}

/** Width and height of an image, read by sharp (no decode of the pixels). */
async function sharpSize(bytes: Uint8Array): Promise<{ width: number; height: number } | null> {
  const meta = await sharp(bytes).metadata()
  return meta.width && meta.height ? { width: meta.width, height: meta.height } : null
}

/** Downloads one image; null when it is larger than we accept. */
async function download(
  src: string,
  deps: ThemeImportDeps,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const res = await safeFetch(src, {
    timeoutMs: 20_000,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.lookup ? { lookup: deps.lookup } : {}),
  })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`download failed (${res.status})`)
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!isAllowedContentType(contentType) || !isImageContentType(contentType)) {
    await res.body?.cancel()
    throw new Error(`${contentType || 'unknown type'} is not an image we accept`)
  }
  const bytes = await readCapped(res, maxUploadBytesFor(contentType))
  return bytes ? { bytes, contentType } : null
}

/** The widest copy we ask Shopify's CDN for when the original is over our upload limit. */
const RESIZED_WIDTH = 3000

/** Copies one image from the merchant's Shopify store into Files. */
async function copyImage(
  tx: StoreTx,
  storeId: string,
  host: string,
  name: string,
  deps: ThemeImportDeps,
): Promise<{ url: string; width: number | null; height: number | null }> {
  const src = `https://${host}/cdn/shop/files/${name.split('/').map(encodeURIComponent).join('/')}`
  // Shopify's CDN resizes on request; a huge original comes over as a smaller copy.
  const file = (await download(src, deps)) ?? (await download(`${src}?width=${RESIZED_WIDTH}`, deps))
  if (!file) throw new Error('image is too large')
  const { bytes, contentType } = file
  const id = newId()
  const key = mediaKey({ storeId, filename: name.split('/').pop() ?? 'image', contentType, id })
  await deps.storage.put({ key, body: bytes, contentType })
  const size = await (deps.imageSize ?? sharpSize)(bytes).catch(() => null)
  const url = deps.storage.publicUrl(key)
  await tx.insert(media).values({
    id,
    storeId,
    url,
    key,
    provider: deps.storage.id,
    contentType,
    size: bytes.byteLength,
    alt: null,
    width: size?.width ?? null,
    height: size?.height ?? null,
    status: 'ready',
  })
  return { url, width: size?.width ?? null, height: size?.height ?? null }
}

/** Runs `work` over `items`, `limit` at a time. */
async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(work))
  }
}

type Hosted = Map<string, { url: string; width: number | null; height: number | null }>

/**
 * A stored setting value: image settings become `{ url, alt }` pointing at Files,
 * Shopify resource links become our paths. Product, collection and menu settings keep
 * their handles (ours match, since the catalogue import keeps Shopify's handles).
 */
function storedValue(setting: ShopifySetting | undefined, value: unknown, hosted: Hosted): unknown {
  if (typeof value === 'string') {
    const m = SHOP_IMAGE.exec(value)
    if (m?.[1]) {
      const h = hosted.get(m[1])
      if (setting && setting.type !== 'image_picker') return h?.url ?? ''
      return h ? { url: h.url, alt: '', width: h.width, height: h.height } : { url: '', alt: '' }
    }
    if (value.startsWith('shopify://')) return shopifyUrlToPath(value)
    if (setting?.type === 'image_picker') return value ? { url: value, alt: '' } : { url: '', alt: '' }
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
  const data = text ? parseThemeJson<{ current?: unknown; presets?: Record<string, unknown> }>(text) : null
  const current = data?.current
  if (typeof current === 'string') return (data?.presets?.[current] as Record<string, unknown>) ?? {}
  return current && typeof current === 'object' ? (current as Record<string, unknown>) : {}
}

/** Where each section type is placed, by template or group. */
function placements(templates: Map<string, ShopifyJsonTemplate>): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>()
  for (const [name, tpl] of templates) {
    for (const key of tpl.order) {
      const type = tpl.sections[key]?.type
      if (!type) continue
      const set = used.get(type) ?? new Set<string>()
      set.add(name)
      used.set(type, set)
    }
  }
  return used
}

const APP_BLOCK = /^(@app|shopify:\/\/apps\/)/

/** Builds the report: every section file, where it is used, and what runs it now. */
function buildReport(input: {
  sections: Map<string, { raw: string; schema: ShopifySectionSchema | null }>
  templates: Map<string, ShopifyJsonTemplate>
  liquidTemplates: string[]
  schemaLocale: Record<string, unknown>
  themeInfo: { name: string; version: string; author: string }
  images: ImportReport['images']
  skippedFiles: string[]
  missing: ImportReport['missing']
  videos: string[]
}): ImportReport {
  const engine = createThemeEngine(new Map())
  const used = placements(input.templates)
  const appBlocksIn = new Set<string>()
  for (const tpl of input.templates.values()) {
    for (const s of Object.values(tpl.sections)) {
      if (Object.values(s.blocks ?? {}).some((b) => APP_BLOCK.test(b.type))) appBlocksIn.add(s.type)
    }
  }
  const swaps = new Set<SwapKey>()
  const sections: SectionReport[] = [...input.sections].map(([type, { raw, schema }]) => {
    const body = withoutSchema(raw)
    const reasons: ReportReason[] = swapsIn(body).filter((k) => k !== 'app_blocks')
    if (appBlocksIn.has(type)) reasons.push('app_blocks')
    if (isMainSection(type)) reasons.push('main_template')
    let error: string | undefined
    try {
      engine.parse(normalizeLiquid(body))
    } catch (err) {
      reasons.push('parse_error')
      error = err instanceof Error ? err.message.split('\n')[0] : String(err)
    }
    for (const r of reasons) if (r !== 'main_template' && r !== 'parse_error') swaps.add(r)
    const placedIn = [...(used.get(type) ?? [])].map((t) =>
      t === 'index' ? 'home' : t.replace(/-group$/, ''),
    )
    return {
      type,
      name: schemaText(schema?.name, input.schemaLocale) || type,
      status: statusFor(reasons),
      reasons,
      usedIn: placedIn,
      ...(error ? { error } : {}),
    }
  })
  const onImported = sections.filter((s) =>
    s.usedIn.some((u) => u === 'home' || u === 'header' || u === 'footer'),
  )
  const templateNames = [...input.templates.keys()].filter((n) => !n.endsWith('-group'))
  const templates: TemplateReport[] = [...templateNames, ...input.liquidTemplates]
    .sort()
    .map((name) => ({ name, status: IMPORTED_TEMPLATES.has(name) ? 'imported' : 'ours' }))
  if (input.images.copied > 0 || input.images.failed.length) swaps.add('hosted_images')
  return {
    version: 1,
    themeName: input.themeInfo.name,
    themeVersion: input.themeInfo.version,
    themeAuthor: input.themeInfo.author,
    imported: countStatuses(onImported),
    all: countStatuses(sections),
    sections: sections.sort(
      (a, b) =>
        Number(b.usedIn.length > 0) - Number(a.usedIn.length > 0) || a.type.localeCompare(b.type),
    ),
    templates,
    swaps: [...swaps],
    images: input.images,
    skippedFiles: input.skippedFiles.slice(0, 200),
    missing: input.missing,
    videos: input.videos,
  }
}

const SHOP_VIDEO = /^shopify:\/\/files\/videos\/(.+)$/

/** Every `shopify://files/videos/...` name inside a JSON value. */
function collectShopVideos(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const m = SHOP_VIDEO.exec(value)
    if (m?.[1]) into.add(m[1])
  } else if (Array.isArray(value)) for (const v of value) collectShopVideos(v, into)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectShopVideos(v, into)
}

type Wanted = { menus: Set<string>; collections: Set<string>; products: Set<string>; blogs: Set<string> }

/** Handles the imported pages' settings point at, by the setting's type. */
function collectHandles(
  tpl: ShopifyJsonTemplate | undefined,
  schemas: Map<string, ShopifySectionSchema | null>,
  into: Wanted,
): void {
  const add = (settings: ShopifySetting[] | undefined, values: Record<string, unknown> | undefined) => {
    for (const s of settings ?? []) {
      const v = s.id ? values?.[s.id] : undefined
      const list = Array.isArray(v) ? v : [v]
      for (const h of list) {
        if (typeof h !== 'string' || !h) continue
        if (s.type === 'link_list') into.menus.add(h)
        if (s.type === 'collection' || s.type === 'collection_list') into.collections.add(h)
        if (s.type === 'product' || s.type === 'product_list') into.products.add(h)
        if (s.type === 'blog') into.blogs.add(h)
      }
    }
  }
  for (const key of tpl?.order ?? []) {
    const section = tpl?.sections[key]
    if (!section || section.disabled) continue
    const schema = schemas.get(section.type)
    add(schema?.settings, section.settings)
    for (const b of Object.values(section.blocks ?? {})) {
      add(schema?.blocks?.find((x) => x.type === b.type)?.settings, b.settings)
    }
  }
}

/** Which of the wanted handles this store does not have. */
async function missingHandles(tx: StoreTx, wanted: Wanted): Promise<ImportReport['missing']> {
  const have = async (list: Set<string>, load: (h: string[]) => Promise<{ handle: string }[]>) => {
    if (list.size === 0) return []
    const found = new Set((await load([...list])).map((r) => r.handle))
    return [...list].filter((h) => !found.has(h)).sort()
  }
  return {
    menus: await have(wanted.menus, (h) =>
      tx.select({ handle: navigationMenu.handle }).from(navigationMenu).where(inArray(navigationMenu.handle, h)),
    ),
    collections: await have(wanted.collections, (h) =>
      tx.select({ handle: collection.handle }).from(collection).where(inArray(collection.handle, h)),
    ),
    products: await have(wanted.products, (h) =>
      tx.select({ handle: product.handle }).from(product).where(inArray(product.handle, h)),
    ),
    blogs: await have(wanted.blogs, (h) =>
      tx.select({ handle: blog.handle }).from(blog).where(inArray(blog.handle, h)),
    ),
  }
}

/** `theme_info` from settings_schema.json. */
function themeInfoOf(archive: ThemeArchive, fileName: string) {
  const schema = parseThemeJson<{ name?: string; theme_name?: string; theme_version?: string; theme_author?: string }[]>(
    archiveText(archive, 'config/settings_schema.json') ?? '[]',
  )
  const info = schema?.find((g) => g.name === 'theme_info')
  const base = fileName.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim()
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
    if (err instanceof ThemeArchiveProblem) throw new ThemeImportError('THEME_IMPORT_INVALID', err.message)
    throw err
  }
  const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(theme)
  if (n >= MAX_THEMES) {
    throw new ThemeImportError('THEME_LIMIT', `You can keep ${MAX_THEMES} themes. Delete one to import another.`)
  }

  const host = cleanShopifyHost(input.shopifyHost)
  const schemaLocale =
    [...archive.files.keys()]
      .filter((p) => p.startsWith('locales/') && p.endsWith('.default.schema.json'))
      .map((p) => parseThemeJson<Record<string, unknown>>(archiveText(archive, p) ?? '') ?? {})[0] ?? {}

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

  // Images the theme's templates and settings point at, copied from the old store.
  const settings = currentSettings(archive)
  const wanted = new Set<string>()
  for (const name of [...IMPORTED_TEMPLATES, 'header-group', 'footer-group']) {
    collectShopImages(templates.get(name), wanted)
  }
  collectShopImages(settings, wanted)
  const hosted: Hosted = new Map()
  const failed: string[] = []
  if (host) {
    await inBatches([...wanted], 6, async (name) => {
      try {
        hosted.set(name, await copyImage(tx, storeId, host, name, deps))
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  // The theme row: unpublished, keeping the live theme's brand settings for our own pages.
  const info = themeInfoOf(archive, input.fileName)
  const [live] = await tx.select({ settings: theme.settings }).from(theme).where(eq(theme.role, 'main'))
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
  for (let i = 0; i < rows.length; i += 100) await tx.insert(themeFile).values(rows.slice(i, i + 100))

  // Theme settings typed by settings_schema.json, images pointed at Files.
  const settingsSchema = (
    parseThemeJson<{ settings?: ShopifySetting[] }[]>(archiveText(archive, 'config/settings_schema.json') ?? '[]') ?? []
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
    images: { copied: hosted.size, failed, skippedNoHost: host ? 0 : wanted.size },
    skippedFiles: archive.skipped,
    missing: await missingHandles(tx, wantedHandles),
    videos: [...videos].sort(),
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
