import { productsListContent } from '@/data/products'
import type { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'

type Row = Awaited<ReturnType<typeof api.products.exportRows>>[number]

/** Column order matches Shopify's product CSV, so an export can be re-imported. */
const HEADERS = [
  'Handle',
  'Title',
  'Vendor',
  'Type',
  'Tags',
  'Status',
  'Option1 Value',
  'Variant SKU',
  'Variant Barcode',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Cost',
  'Variant Grams',
  'Variant Inventory Qty',
  'Variant Requires Shipping',
]

const rupees = (paise: number | null) => (paise == null ? '' : (paise / 100).toFixed(2))

/** Turn export rows into a CSV and hand it to the browser. */
export function downloadProductCsv(rows: Row[]) {
  downloadCsv(
    productsListContent.exporting.filename,
    toCsv(
      HEADERS,
      rows.map((r) => [
        r.handle,
        r.title,
        r.vendor,
        r.productType,
        r.tags.join(', '),
        r.status,
        r.variantTitle,
        r.sku,
        r.barcode,
        rupees(r.pricePaise),
        rupees(r.mrpPaise),
        rupees(r.costPaise),
        r.weightGrams,
        r.onHand,
        r.requiresShipping ? 'TRUE' : 'FALSE',
      ]),
    ),
  )
}
