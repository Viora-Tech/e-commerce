import { cn } from '@commerce/ui/lib/utils'
import { type Column, renderTextEditor } from 'react-data-grid'
import type { bulkEditContent } from '@/data/bulk-edit'
import {
  BOOLEAN_COLUMNS,
  type CellErrors,
  cellValue,
  errorKey,
  type GridRow,
  isDirty,
  STOCK_PREFIX,
} from './bulk-edit-model'
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
  { key: 'price', group: 'variant', width: 110 },
  { key: 'mrp', group: 'variant', width: 120 },
  { key: 'cost', group: 'variant', width: 110 },
  { key: 'sku', group: 'variant', width: 140 },
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

/**
 * The grid's columns, in sheet order: product cells (the first one frozen), variant cells, then
 * one stock column per location. Cells that differ from the saved sheet get the soft accent
 * wash; cells with a validation problem get the danger wash and the message as a tooltip.
 */
export function buildColumns(
  copy: Copy,
  locations: SheetLocation[],
  base: Map<string, GridRow>,
  errors: CellErrors,
  hidden: Set<string>,
): Column<GridRow>[] {
  const c = copy.columns as Record<string, string | ((location: string) => string)>
  const specs: ColumnDef[] = [
    ...COLUMN_DEFS.filter((d) => isShown(d.key, hidden)),
    ...(hidden.has(STOCK_GROUP_KEY)
      ? []
      : locations.map((l) => ({
          key: `${STOCK_PREFIX}${l.id}`,
          group: 'variant' as const,
          width: 150,
        }))),
  ]
  return specs.map((s) => ({
    key: s.key,
    name: s.key.startsWith(STOCK_PREFIX)
      ? copy.columns.stock(locations.find((l) => `${STOCK_PREFIX}${l.id}` === s.key)?.name ?? '')
      : String(c[s.key]),
    width: s.width,
    frozen: s.key === 'title',
    editable: !s.readOnly,
    renderEditCell: SELECT_KEYS.has(s.key) ? BulkSelectEditor : renderTextEditor,
    renderCell: renderCellOf(copy, s.key),
    cellClass: (row) =>
      cn(
        'text-body',
        NUMERIC.has(s.key) || s.key.startsWith(STOCK_PREFIX) ? 'text-end tabular-nums' : '',
        s.readOnly ? 'bg-muted text-muted-foreground' : '',
        isDirty(row, base.get(row.variantId), s.key) ? 'bg-primary-soft' : '',
        errors.has(errorKey(row.variantId, s.key)) ? 'bg-danger-soft text-danger' : '',
      ),
  }))
}

/** Select cells show their label, not the stored word. */
function renderCellOf(copy: Copy, key: string): Column<GridRow>['renderCell'] {
  if (key === 'status')
    return ({ row }) => copy.statuses[row.status as keyof typeof copy.statuses] ?? row.status
  if ((BOOLEAN_COLUMNS as readonly string[]).includes(key))
    return ({ row }) =>
      copy.yesNo[cellValue(row, key) as keyof typeof copy.yesNo] ?? cellValue(row, key)
  return undefined
}

/** Every shown column key in sheet order, for paste, fill and Ctrl+D to count across. */
export const columnKeys = (locations: SheetLocation[], hidden: Set<string>) => [
  ...COLUMN_DEFS.filter((d) => isShown(d.key, hidden)).map((d) => d.key),
  ...(hidden.has(STOCK_GROUP_KEY) ? [] : locations.map((l) => `${STOCK_PREFIX}${l.id}`)),
]

/** The cells nobody edits: which variant the row is, and the description preview. */
export const isEditableKey = (key: string) => !['variantTitle', 'description'].includes(key)
