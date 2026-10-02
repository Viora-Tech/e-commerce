/** SOURCE OF TRUTH: imported theme bundles — WHAT: a theme's files as the renderer needs them (sections and blocks with their schemas, snippets, layout, locales, settings, asset checksums), Shopify-only Liquid normalised, and one parsed-template cache per theme version / WHY: parsing is the slow half of a render; building once per version keeps renders fast */
import type { Liquid, Template } from 'liquidjs'
import { createThemeEngine } from './engine'
import {
  extractSchema,
  parseThemeJson,
  type ShopifySectionSchema,
  type ShopifySetting,
  withoutSchema,
} from './schema'

/** A theme's files as the renderer needs them; built once per theme version and cached. */
export type ThemeBundle = {
  themeId: string
  /** Changes whenever the theme's files or settings change; part of every cache key. */
  version: string
  sections: Map<string, { source: string; schema: ShopifySectionSchema | null }>
  blocks: Map<string, { source: string; schema: ShopifySectionSchema | null }>
  snippets: Map<string, string>
  layout: string | null
  /** `locales/<default>.json`. */
  locale: Record<string, unknown>
  /** `locales/<default>.schema.json`, for setting labels in the editor. */
  schemaLocale: Record<string, unknown>
  /** `config/settings_schema.json`: groups of theme settings. */
  settingsSchema: { name?: string; settings?: ShopifySetting[] }[]
  /** Current theme settings (`settings_data.json`), as imported. */
  settings: Record<string, unknown>
  /** `assets/<file>` → checksum, for versioned URLs. */
  assets: Map<string, string>
  /** Text assets (`.css`, `.js`, `.svg`), for `inline_asset_content`. */
  assetText: (file: string) => string | null
}

/** Text files of a theme, by path, plus asset checksums: what `buildThemeBundle` reads. */
export type ThemeBundleInput = {
  themeId: string
  version: string
  textFiles: Map<string, string>
  assetChecksums: Map<string, string>
  settings: Record<string, unknown>
}

const nameOf = (path: string, folder: string, ext: string) =>
  path.startsWith(`${folder}/`) && path.endsWith(ext)
    ? path.slice(folder.length + 1, -ext.length)
    : null

/** The default locale file among `locales/*.json` (`en.default.json`), and its schema twin. */
function defaultLocale(files: Map<string, string>, schema: boolean): Record<string, unknown> {
  const suffix = schema ? '.default.schema.json' : '.default.json'
  for (const [path, text] of files) {
    if (path.startsWith('locales/') && path.endsWith(suffix)) {
      return parseThemeJson<Record<string, unknown>>(text) ?? {}
    }
  }
  return {}
}

/**
 * Shopify allows `comment … endcomment` inside a `{% liquid %}` tag; LiquidJS reads
 * every line there as a tag, so those comment lines are dropped before parsing.
 */
export function normalizeLiquid(source: string): string {
  return source.replace(/{%-?\s*liquid\b([\s\S]*?)-?%}/g, (whole, body: string) => {
    if (!/^\s*comment\s*$/m.test(body)) return whole
    const lines = body.split('\n')
    const kept: string[] = []
    let depth = 0
    for (const line of lines) {
      const t = line.trim()
      if (t === 'comment') depth += 1
      else if (t === 'endcomment' && depth > 0) depth -= 1
      else if (depth === 0) kept.push(line)
    }
    return whole.replace(body, kept.join('\n'))
  })
}

export function buildThemeBundle(input: ThemeBundleInput): ThemeBundle {
  const sections = new Map<string, { source: string; schema: ShopifySectionSchema | null }>()
  const blocks = new Map<string, { source: string; schema: ShopifySectionSchema | null }>()
  const snippets = new Map<string, string>()
  for (const [path, raw] of input.textFiles) {
    const text = path.endsWith('.liquid') ? normalizeLiquid(raw) : raw
    const section = nameOf(path, 'sections', '.liquid')
    if (section) sections.set(section, { source: withoutSchema(text), schema: extractSchema(text) })
    const block = nameOf(path, 'blocks', '.liquid')
    if (block) blocks.set(block, { source: withoutSchema(text), schema: extractSchema(text) })
    const snippet = nameOf(path, 'snippets', '.liquid')
    if (snippet) snippets.set(snippet, text)
  }
  const schemaText = input.textFiles.get('config/settings_schema.json')
  return {
    themeId: input.themeId,
    version: input.version,
    sections,
    blocks,
    snippets,
    layout: normalizeLiquid(input.textFiles.get('layout/theme.liquid') ?? '') || null,
    locale: defaultLocale(input.textFiles, false),
    schemaLocale: defaultLocale(input.textFiles, true),
    settingsSchema:
      (schemaText ? parseThemeJson<ThemeBundle['settingsSchema']>(schemaText) : null) ?? [],
    settings: input.settings,
    assets: input.assetChecksums,
    assetText: (file) => input.textFiles.get(`assets/${file}`) ?? null,
  }
}

/** Parsed templates per theme version: parsing is the slow half of a render. */
export type EngineEntry = { version: string; engine: Liquid; parsed: Map<string, Template[]> }
const engines = new Map<string, EngineEntry>()
const MAX_ENGINES = 8

export function engineFor(bundle: ThemeBundle): EngineEntry {
  const hit = engines.get(bundle.themeId)
  if (hit && hit.version === bundle.version) return hit
  const entry = {
    version: bundle.version,
    engine: createThemeEngine(bundle.snippets),
    parsed: new Map(),
  }
  engines.delete(bundle.themeId)
  engines.set(bundle.themeId, entry)
  while (engines.size > MAX_ENGINES) {
    const oldest = engines.keys().next().value
    if (oldest === undefined) break
    engines.delete(oldest)
  }
  return entry
}

export function parsed(entry: EngineEntry, key: string, source: string): Template[] {
  const hit = entry.parsed.get(key)
  if (hit) return hit
  const tpl = entry.engine.parse(source, key)
  entry.parsed.set(key, tpl)
  return tpl
}
