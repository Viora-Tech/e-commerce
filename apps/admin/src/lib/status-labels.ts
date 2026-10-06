import { homeContent } from '@/data/home'
import { orderDetailContent, ordersContent } from '@/data/orders'
import { productsListContent } from '@/data/products'
import { reviewsContent } from '@/data/reviews'
import { shipmentPanelContent } from '@/data/shipping'
import { shopifyImportContent } from '@/data/shopify-import'
import { localize } from '@/lib/copy'
import type { Locale } from '@/lib/i18n'

/**
 * `data/status.ts` builds its badge labels from these copy objects at module scope, in
 * English. Rather than rebuild that table per language, a badge looks its English label up
 * here and gets the text at the same key of the translated object. Labels from files with no
 * Hindi yet (or hard-coded ones like "Active") stay English.
 */
const SOURCES: readonly unknown[] = [
  ordersContent,
  orderDetailContent,
  shipmentPanelContent,
  productsListContent,
  reviewsContent,
  homeContent,
  shopifyImportContent,
]

function collect(en: unknown, local: unknown, into: Map<string, string>) {
  if (typeof en === 'string') {
    if (typeof local === 'string' && local !== en && !into.has(en)) into.set(en, local)
    return
  }
  if (typeof en !== 'object' || en === null || typeof local !== 'object' || local === null) return
  for (const key of Object.keys(en)) {
    collect((en as Record<string, unknown>)[key], (local as Record<string, unknown>)[key], into)
  }
}

const byLocale = new Map<Locale, Map<string, string>>()

/** A status badge's English label in `locale`, when one of the sources translates it. */
export function localizeStatusLabel(label: string, locale: Locale): string {
  if (locale === 'en') return label
  let table = byLocale.get(locale)
  if (!table) {
    table = new Map()
    for (const en of SOURCES) collect(en, localize(en, locale), table)
    byLocale.set(locale, table)
  }
  return table.get(label) ?? label
}
