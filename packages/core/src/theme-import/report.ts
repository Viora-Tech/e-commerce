/** SOURCE OF TRUTH: the import report — WHAT: what happened to every section and template of an imported Shopify theme (imported exactly, replaced with ours, not available, unsupported) with a reason key the admin turns into plain English or Hindi / WHY: the owner's rule is to tell merchants in plain words what Shopify used and what we offer instead; this is the record the report page reads. Browser safe */
import { SWAP_TABLE, type SwapKey } from './swap'

export type ImportStatus = 'imported' | 'replaced' | 'unavailable' | 'unsupported'

/** Why a section got its status. Swap keys come from `swap.ts`; the rest are below. */
export type ReportReason = SwapKey | 'main_template' | 'parse_error'

export type SectionReport = {
  type: string
  /** The section's own name from its schema (English). */
  name: string
  status: ImportStatus
  reasons: ReportReason[]
  /** Where the theme places it: `home`, `header`, `footer`, or another template's name. */
  usedIn: string[]
  /** The Liquid parser's message, for `unsupported`. */
  error?: string | undefined
}

export type TemplateReport = {
  /** Shopify's template name, e.g. `index`, `product`, `customers/account`. */
  name: string
  /** `imported`: renders the theme's sections. `ours`: runs on our own page (header and footer from the theme). */
  status: 'imported' | 'ours'
}

export type ImportCounts = Record<ImportStatus, number>

export type ImportReport = {
  version: 1
  themeName: string
  themeVersion: string
  themeAuthor: string
  /** Sections on the imported pages (home, product, collection and page templates, header and footer). */
  imported: ImportCounts
  /** Every section file in the theme. */
  all: ImportCounts
  sections: SectionReport[]
  templates: TemplateReport[]
  /** Swap rows that apply to this theme. */
  swaps: SwapKey[]
  /** Images copied from Shopify into Files, and those that could not be. */
  images: { copied: number; videosCopied: number; failed: string[]; skippedNoHost: number }
  /** Files left out of the zip (wrong folder or type). */
  skippedFiles: string[]
  /**
   * Things the imported pages point at that this store does not have yet (by handle):
   * import products and menus first, or pick others in Customize.
   */
  missing: { menus: string[]; collections: string[]; products: string[]; blogs: string[] }
  /** Videos stored in Shopify Files: they cannot be copied, the merchant uploads them again. */
  videos: string[]
}

const PRECEDENCE: ImportStatus[] = ['unsupported', 'unavailable', 'replaced', 'imported']

const zero = (): ImportCounts => ({ imported: 0, replaced: 0, unavailable: 0, unsupported: 0 })

export function countStatuses(sections: SectionReport[]): ImportCounts {
  const counts = zero()
  for (const s of sections) counts[s.status] += 1
  return counts
}

/** The worst status among a section's reasons (unsupported beats unavailable beats replaced). */
export function importStatusFor(reasons: ReportReason[]): ImportStatus {
  const statuses = new Set<ImportStatus>(
    reasons.map((r) => {
      if (r === 'parse_error') return 'unsupported'
      if (r === 'main_template') return 'replaced'
      return SWAP_TABLE.find((row) => row.key === r)?.kind ?? 'replaced'
    }),
  )
  return PRECEDENCE.find((s) => statuses.has(s)) ?? 'imported'
}

/**
 * Templates a theme import turns into our templates, with their alternates (`page.about`,
 * `product.preorder`); the rest run on our pages. A resource template keeps the theme's
 * sections around our own main section (`main_template`).
 */
export const IMPORTED_TEMPLATES = new Set(['index', 'product', 'collection', 'page'])

/** Whether a Shopify template name (`page.about` included) is turned into one of ours. */
export const isImportedTemplate = (name: string): boolean =>
  IMPORTED_TEMPLATES.has(name.split('.')[0] ?? name)

/** Sections that draw a resource page's main content (product, collection, cart...). */
export const isMainSection = (type: string): boolean => type.startsWith('main-') || type === 'main'
