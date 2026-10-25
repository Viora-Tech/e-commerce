/** SOURCE OF TRUTH: building the import report — WHAT: where each section is placed, what Liquid each one relies on (swap table, app blocks, main templates, parse errors) and which menus, collections, products and blogs the imported pages point at that this store lacks / WHY: the merchant reads this to know what runs on our features and what to add before publishing */
import { blog, collection, navigationMenu, product, type StoreTx } from '@commerce/db'
import { inArray } from 'drizzle-orm'
import { normalizeLiquid } from './bundle'
import { createThemeEngine } from './engine'
import { schemaText } from './fields'
import {
  countStatuses,
  type ImportReport,
  importStatusFor,
  isImportedTemplate,
  isMainSection,
  type ReportReason,
  type SectionReport,
  type TemplateReport,
} from './report'
import {
  type ShopifyJsonTemplate,
  type ShopifySectionSchema,
  type ShopifySetting,
  withoutSchema,
} from './schema'
import { type SwapKey, swapsIn } from './swap'

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
export function buildReport(input: {
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
    // Ours replaces a main section, except on page templates, which keep the theme's (import.ts).
    const placed = [...(used.get(type) ?? [])]
    if (
      isMainSection(type) &&
      (placed.length === 0 || placed.some((t) => !/^page(\.|$)/.test(t)))
    ) {
      reasons.push('main_template')
    }
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
      status: importStatusFor(reasons),
      reasons,
      usedIn: placedIn,
      ...(error ? { error } : {}),
    }
  })
  const onImported = sections.filter((s) =>
    s.usedIn.some((u) => u === 'home' || u === 'header' || u === 'footer' || isImportedTemplate(u)),
  )
  const templateNames = [...input.templates.keys()].filter((n) => !n.endsWith('-group'))
  const templates: TemplateReport[] = [...templateNames, ...input.liquidTemplates]
    .sort()
    .map((name) => ({ name, status: isImportedTemplate(name) ? 'imported' : 'ours' }))
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

export type Wanted = {
  menus: Set<string>
  collections: Set<string>
  products: Set<string>
  blogs: Set<string>
}

/** Handles the imported pages' settings point at, by the setting's type. */
export function collectHandles(
  tpl: ShopifyJsonTemplate | undefined,
  schemas: Map<string, ShopifySectionSchema | null>,
  into: Wanted,
): void {
  const add = (
    settings: ShopifySetting[] | undefined,
    values: Record<string, unknown> | undefined,
  ) => {
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
export async function missingHandles(
  tx: StoreTx,
  wanted: Wanted,
): Promise<ImportReport['missing']> {
  const have = async (list: Set<string>, load: (h: string[]) => Promise<{ handle: string }[]>) => {
    if (list.size === 0) return []
    const found = new Set((await load([...list])).map((r) => r.handle))
    return [...list].filter((h) => !found.has(h)).sort()
  }
  return {
    menus: await have(wanted.menus, (h) =>
      tx
        .select({ handle: navigationMenu.handle })
        .from(navigationMenu)
        .where(inArray(navigationMenu.handle, h)),
    ),
    // `all` is every product, which every store has (Shopify's built-in collection).
    collections: await have(new Set([...wanted.collections].filter((h) => h !== 'all')), (h) =>
      tx
        .select({ handle: collection.handle })
        .from(collection)
        .where(inArray(collection.handle, h)),
    ),
    products: await have(wanted.products, (h) =>
      tx.select({ handle: product.handle }).from(product).where(inArray(product.handle, h)),
    ),
    blogs: await have(wanted.blogs, (h) =>
      tx.select({ handle: blog.handle }).from(blog).where(inArray(blog.handle, h)),
    ),
  }
}
