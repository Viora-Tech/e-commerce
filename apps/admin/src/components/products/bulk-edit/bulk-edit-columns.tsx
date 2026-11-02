import { formatMoney } from '@commerce/money'
import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { type Column, renderTextEditor } from 'react-data-grid'
import type { bulkEditContent } from '@/data/bulk-edit'
import {
  BOOLEAN_COLUMNS,
  type CellErrors,
  cellValue,
  errorKey,
  type GridRow,
  isDirty,
  parsePaise,
  STOCK_PREFIX,
} from './bulk-edit-model'
import { isBlankInView, isViewEditable, type ViewRow } from './bulk-edit-view'
import BulkSelectEditor from './bulk-select-editor'

type Copy = typeof bulkEditContent
export type SheetLocation = { id: string; name: string }

/** Where a column sits in the Columns menu. */
export type ColumnGroup = 'product' | 'variant'

export type ColumnDef = {
  key: string
  group: ColumnGroup
  width: number
  readOnly?: boolean
  /** Long text: off until the person turns it on. */
  hiddenByDefault?: boolean
}

/** Every fixed column in sheet order: product cells (title frozen), then variant cells. */
export const COLUMN_DEFS: ColumnDef[] = [
  { key: 'title', group: 'product', width: 240 },
  { key: 'variantTitle', group: 'variant', width: 140, readOnly: true },
  { key: 'price', group: 'variant', width: 110 },
  { key: 'mrp', group: 'variant', width: 120 },
  { key: 'cost', group: 'variant', width: 110 },
  { key: 'sku', group: 'variant', width: 140 },
  { key: 'status', group: 'product', width: 110 },
  { key: 'handle', group: 'product', width: 200 },
  { key: 'vendor', group: 'product', width: 140 },
  { key: 'productType', group: 'product', width: 140 },
  { key: 'collections', group: 'product', width: 200 },
  { key: 'tags', group: 'product', width: 180 },
  { key: 'description', group: 'product', width: 260, readOnly: true, hiddenByDefault: true },
  { key: 'seoTitle', group: 'product', width: 200 },
  { key: 'seoDescription', group: 'product', width: 260, hiddenByDefault: true },
  { key: 'featured', group: 'product', width: 110 },
  { key: 'taxIncluded', group: 'product', width: 150 },
  { key: 'templateSuffix', group: 'product', width: 130 },
  { key: 'barcode', group: 'variant', width: 140 },
  { key: 'weight', group: 'variant', width: 120 },
  { key: 'hsCode', group: 'variant', width: 100 },
  { key: 'gst', group: 'variant', width: 90 },
  { key: 'trackInventory', group: 'variant', width: 130 },
  { key: 'countryOfOrigin', group: 'variant', width: 110 },
  { key: 'packageLength', group: 'variant', width: 120 },
  { key: 'packageWidth', group: 'variant', width: 120 },
  { key: 'packageHeight', group: 'variant', width: 120 },
]

/** Columns that cannot be hidden: they say which row you are on. */
export const PINNED_KEYS = ['title', 'variantTitle']

/** The Columns menu's one switch for every per-location stock column. */
export const STOCK_GROUP_KEY = 'stock'

/** Columns shown until the person changes it. */
export const DEFAULT_HIDDEN = COLUMN_DEFS.filter((d) => d.hiddenByDefault).map((d) => d.key)

/** Opened from Inventory for a restock (#1033): the product, variant and SKU, then stock. */
const STOCK_FOCUS_SHOWN = new Set(['title', 'variantTitle', 'sku'])
export const STOCK_FOCUS_HIDDEN = COLUMN_DEFS.filter((d) => !STOCK_FOCUS_SHOWN.has(d.key)).map(
  (d) => d.key,
)

const NUMERIC = new Set([
  'price',
  'mrp',
  'cost',
  'weight',
  'gst',
  'packageLength',
  'packageWidth',
  'packageHeight',
])
const SELECT_KEYS = new Set(['status', ...BOOLEAN_COLUMNS])

const isShown = (key: string, hidden: Set<string>) => !hidden.has(key)

/** What merchants edit most comes first: price, MRP, cost, SKU, then stock (audit #205). */
const MONEY_AND_SKU = ['price', 'mrp', 'cost', 'sku']

/** Where the stock columns go: right after the last shown money / SKU column. */
function afterMoney(keys: string[]): number {
  let at = 2
  keys.forEach((k, i) => {
    if (MONEY_AND_SKU.includes(k)) at = i + 1
  })
  return Math.min(at, keys.length)
}

/** Expand state for the product rows (#985). */
export type ExpandControl = {
  expanded: ReadonlySet<string>
  onToggle: (productId: string) => void
}

const MONEY_KEYS = new Set(['price', 'mrp', 'cost'])

/**
 * The grid's columns, in sheet order: product cells (the first one frozen), variant cells, then
 * one stock column per location. A product with several variants is one row that expands to its
 * variants. Cells that differ from the saved sheet get the soft accent wash; cells with a
 * validation problem get the danger wash.
 */
export function buildColumns(
  copy: Copy,
  locations: SheetLocation[],
  base: Map<string, GridRow>,
  errors: CellErrors,
  hidden: Set<string>,
  expand: ExpandControl,
): Column<ViewRow>[] {
  const c = copy.columns as Record<string, string | ((location: string) => string)>
  const stock: ColumnDef[] = hidden.has(STOCK_GROUP_KEY)
    ? []
    : locations.map((l) => ({
        key: `${STOCK_PREFIX}${l.id}`,
        group: 'variant' as const,
        width: 150,
      }))
  const shown = COLUMN_DEFS.filter((d) => isShown(d.key, hidden))
  const cut = afterMoney(shown.map((d) => d.key))
  const specs: ColumnDef[] = [...shown.slice(0, cut), ...stock, ...shown.slice(cut)]
  return specs.map((s) => ({
    key: s.key,
    name: s.key.startsWith(STOCK_PREFIX)
      ? copy.columns.stock(locations.find((l) => `${STOCK_PREFIX}${l.id}` === s.key)?.name ?? '')
      : String(c[s.key]),
    width: s.width,
    frozen: s.key === 'title',
    editable: (row: ViewRow) => !s.readOnly && isViewEditable(row, s.key),
    renderEditCell: SELECT_KEYS.has(s.key) ? BulkSelectEditor : renderTextEditor,
    renderCell: ({ row }) => renderViewCell(copy, s.key, row, expand),
    cellClass: (row) => {
      const blank = isBlankInView(row, s.key)
      const dirty = row.members.some((m) => isDirty(m, base.get(m.variantId), s.key))
      const bad = row.members.some((m) => errors.has(errorKey(m.variantId, s.key)))
      return cn(
        'text-body',
        NUMERIC.has(s.key) || s.key.startsWith(STOCK_PREFIX) ? 'text-end tabular-nums' : '',
        s.readOnly || !isViewEditable(row, s.key) ? 'bg-muted text-muted-foreground' : '',
        !blank && dirty ? 'bg-primary-soft' : '',
        !blank && bad ? 'bg-danger-soft text-danger' : '',
      )
    },
  }))
}

/** A product row's money cell whose variants differ: their range, like "₹999 – ₹1,299". */
function mixedText(copy: Copy, key: string, row: ViewRow): string {
  if (!MONEY_KEYS.has(key)) return copy.view.mixed
  const amounts = row.members.map((m) => parsePaise(cellValue(m, key)))
  const known = amounts.filter((a): a is number => a !== null && !Number.isNaN(a))
  if (known.length === 0) return copy.view.mixed
  const low = Math.min(...known)
  const high = Math.max(...known)
  return low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`
}

/** Select cells show their label, not the stored word; product rows show their variants. */
function renderViewCell(copy: Copy, key: string, row: ViewRow, expand: ExpandControl): ReactNode {
  if (isBlankInView(row, key)) return null
  if (key === 'title' && row.viewKind === 'variant') {
    return <span className="pl-6 text-muted-foreground">{row.variantTitle}</span>
  }
  if (key === 'title' && row.viewKind === 'product') {
    const open = expand.expanded.has(row.productId)
    return (
      <span className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? copy.view.collapse(row.title) : copy.view.expand(row.title)}
          onClick={(e) => {
            e.stopPropagation()
            expand.onToggle(row.productId)
          }}
          className="-ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 transition-[rotate] duration-150 ease-out', open && 'rotate-90')}
          />
        </button>
        <span className="truncate">{row.title}</span>
      </span>
    )
  }
  if (key === 'variantTitle' && row.viewKind === 'product') {
    return <span className="text-muted-foreground">{copy.view.variants(row.members.length)}</span>
  }
  if (row.mixedKeys.includes(key)) {
    return <span className="text-muted-foreground">{mixedText(copy, key, row)}</span>
  }
  if (key === 'status') return copy.statuses[row.status as keyof typeof copy.statuses] ?? row.status
  if ((BOOLEAN_COLUMNS as readonly string[]).includes(key))
    return copy.yesNo[cellValue(row, key) as keyof typeof copy.yesNo] ?? cellValue(row, key)
  return cellValue(row, key)
}

/** Every shown column key in sheet order, for paste, fill and Ctrl+D to count across. */
export const columnKeys = (locations: SheetLocation[], hidden: Set<string>) => {
  const shown = COLUMN_DEFS.filter((d) => isShown(d.key, hidden)).map((d) => d.key)
  const stock = hidden.has(STOCK_GROUP_KEY) ? [] : locations.map((l) => `${STOCK_PREFIX}${l.id}`)
  const cut = afterMoney(shown)
  return [...shown.slice(0, cut), ...stock, ...shown.slice(cut)]
}

/** The cells nobody edits: which variant the row is, and the description preview. */
export const isEditableKey = (key: string) => !['variantTitle', 'description'].includes(key)
