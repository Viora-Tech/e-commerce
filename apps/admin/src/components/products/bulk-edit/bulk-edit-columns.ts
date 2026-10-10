import { cn } from '@commerce/ui/lib/utils'
import { type Column, renderTextEditor } from 'react-data-grid'
import type { bulkEditContent } from '@/data/bulk-edit'
import { type CellErrors, errorKey, type GridRow, isDirty, STOCK_PREFIX } from './bulk-edit-model'
import BulkSelectEditor from './bulk-select-editor'

type Copy = typeof bulkEditContent
export type SheetLocation = { id: string; name: string }

const FIXED_KEYS = [
  'title',
  'variantTitle',
  'status',
  'vendor',
  'productType',
  'tags',
  'price',
  'mrp',
  'cost',
  'sku',
  'barcode',
  'weight',
  'hsCode',
  'gst',
]

const NUMERIC = new Set(['price', 'mrp', 'cost', 'weight', 'gst'])

type Spec = { key: string; name: string; width: number; readOnly?: boolean }

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
): Column<GridRow>[] {
  const c = copy.columns
  const specs: Spec[] = [
    { key: 'title', name: c.title, width: 240 },
    { key: 'variantTitle', name: c.variantTitle, width: 140, readOnly: true },
    { key: 'status', name: c.status, width: 110 },
    { key: 'vendor', name: c.vendor, width: 140 },
    { key: 'productType', name: c.productType, width: 140 },
    { key: 'tags', name: c.tags, width: 180 },
    { key: 'price', name: c.price, width: 110 },
    { key: 'mrp', name: c.mrp, width: 120 },
    { key: 'cost', name: c.cost, width: 110 },
    { key: 'sku', name: c.sku, width: 140 },
    { key: 'barcode', name: c.barcode, width: 140 },
    { key: 'weight', name: c.weight, width: 120 },
    { key: 'hsCode', name: c.hsCode, width: 100 },
    { key: 'gst', name: c.gst, width: 90 },
    ...locations.map((l) => ({
      key: `${STOCK_PREFIX}${l.id}`,
      name: c.stock(l.name),
      width: 150,
    })),
  ]
  return specs.map((s) => ({
    key: s.key,
    name: s.name,
    width: s.width,
    frozen: s.key === 'title',
    editable: !s.readOnly,
    renderEditCell: s.key === 'status' ? BulkSelectEditor : renderTextEditor,
    renderCell:
      s.key === 'status'
        ? ({ row }) => copy.statuses[row.status as keyof typeof copy.statuses] ?? row.status
        : undefined,
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

/** Every column key in sheet order, for paste, fill and Ctrl+D to count across. */
export const columnKeys = (locations: SheetLocation[]) => [
  ...FIXED_KEYS,
  ...locations.map((l) => `${STOCK_PREFIX}${l.id}`),
]

/** The one cell nobody edits: which variant the row is. */
export const isEditableKey = (key: string) => key !== 'variantTitle'
