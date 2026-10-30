import {
  BOOLEAN_COLUMNS,
  cellValue,
  type GridRow,
  PRODUCT_COLUMNS,
  parseYesNo,
  STOCK_PREFIX,
  syncProductCell,
  VARIANT_COLUMNS,
  withCell,
} from './bulk-edit-model'

/**
 * How a sheet row is shown (#985): a product with one variant is one `single` row; a product
 * with several is one `product` row (its variants summed up) and, when expanded, one `variant`
 * row per variant under it.
 */
export type ViewKind = 'single' | 'product' | 'variant'

export type ViewRow = GridRow & {
  /** `product:<productId>` for a product row, the variant id otherwise. */
  viewKey: string
  viewKind: ViewKind
  /** The variants this row stands for: all of them on a product row, itself otherwise. */
  members: GridRow[]
  /** Variant cells whose variants differ, shown as "Mixed" (or a price range) on a product row. */
  mixedKeys: readonly string[]
}

const productKey = (productId: string) => `product:${productId}`

const isProductKey = (key: string) =>
  (PRODUCT_COLUMNS as readonly string[]).includes(key) || key === 'description'

const isStockKey = (key: string) => key.startsWith(STOCK_PREFIX)

/** Every per-variant cell key of a row: the variant columns and one stock cell per location. */
const variantKeysOf = (row: GridRow) => [...VARIANT_COLUMNS, ...Object.keys(row).filter(isStockKey)]

/** One product row for a product with several variants: shared values, blanks where they differ. */
function summaryRow(members: GridRow[]): ViewRow {
  const first = members[0] as GridRow
  let row: GridRow = { ...first, variantTitle: '' }
  const mixedKeys: string[] = []
  for (const key of variantKeysOf(first)) {
    if (isStockKey(key)) {
      const total = members.reduce((sum, m) => sum + (Number(cellValue(m, key)) || 0), 0)
      row = withCell(row, key, String(total))
      continue
    }
    const value = cellValue(first, key)
    if (members.every((m) => cellValue(m, key) === value)) continue
    row = withCell(row, key, '')
    mixedKeys.push(key)
  }
  return {
    ...row,
    viewKey: productKey(first.productId),
    viewKind: 'product',
    members,
    mixedKeys,
  }
}

/** The rows the grid shows, in sheet order, with the expanded products' variants under them. */
export function buildView(rows: GridRow[], expanded: ReadonlySet<string>): ViewRow[] {
  const groups = new Map<string, GridRow[]>()
  for (const r of rows) groups.set(r.productId, [...(groups.get(r.productId) ?? []), r])
  const view: ViewRow[] = []
  for (const [productId, members] of groups) {
    const [only] = members
    if (members.length === 1 && only) {
      view.push({ ...only, viewKey: only.variantId, viewKind: 'single', members, mixedKeys: [] })
      continue
    }
    view.push(summaryRow(members))
    if (!expanded.has(productId)) continue
    for (const m of members) {
      view.push({ ...m, viewKey: m.variantId, viewKind: 'variant', members: [m], mixedKeys: [] })
    }
  }
  return view
}

/** Products with more than one variant: the ones a row can expand. */
export const expandableProductIds = (rows: GridRow[]) => {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.productId, (counts.get(r.productId) ?? 0) + 1)
  return [...counts].filter(([, n]) => n > 1).map(([id]) => id)
}

/**
 * Whether a cell of this row takes typing. A product row edits the product and sets a variant
 * cell on every variant (stock stays per variant); a variant row edits only its own variant.
 */
export function isViewEditable(row: ViewRow, key: string): boolean {
  if (key === 'variantTitle' || key === 'description') return false
  if (row.viewKind === 'product') return !isStockKey(key)
  if (row.viewKind === 'variant') return !isProductKey(key)
  return true
}

/** Product cells are blank on a variant row: the product row above holds them. */
export const isBlankInView = (row: ViewRow, key: string) =>
  row.viewKind === 'variant' && isProductKey(key) && key !== 'title'

/** One typed cell of a shown row, laid over the sheet's variant rows. */
export function setViewCell(rows: GridRow[], target: ViewRow, key: string, value: string) {
  if (!isViewEditable(target, key)) return rows
  if (target.viewKind === 'product') {
    return rows.map((r) => (r.productId === target.productId ? withCell(r, key, value) : r))
  }
  const next = rows.map((r) => (r.variantId === target.variantId ? withCell(r, key, value) : r))
  const changed = next.find((r) => r.variantId === target.variantId)
  return changed ? syncProductCell(next, changed, key) : next
}

/** The cells the grid reports changed, compared with what it showed, laid over the sheet. */
export function applyViewChanges(
  rows: GridRow[],
  before: ViewRow[],
  after: ViewRow[],
  indexes: number[],
  key: string,
): GridRow[] {
  let next = rows
  for (const i of indexes) {
    const was = before[i]
    const now = after[i]
    if (!was || !now) continue
    const value = cellValue(now, key)
    if (value === cellValue(was, key)) continue
    next = setViewCell(next, was, key, value)
  }
  return next
}

/**
 * A pasted block of tab-separated text laid over the shown rows from the active cell: down the
 * rows and across the columns, skipping cells that row does not edit.
 */
export function pasteIntoView(
  rows: GridRow[],
  view: ViewRow[],
  keys: string[],
  start: { rowIdx: number; colIdx: number },
  pasted: string,
): GridRow[] {
  const lines = pasted.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  let next = rows
  lines.forEach((line, dy) => {
    const target = view[start.rowIdx + dy]
    if (!target) return
    line.split('\t').forEach((value, dx) => {
      const key = keys[start.colIdx + dx]
      if (!key || !isViewEditable(target, key)) return
      const isBool = (BOOLEAN_COLUMNS as readonly string[]).includes(key)
      next = setViewCell(next, target, key, isBool ? parseYesNo(value) : value.trim())
    })
  })
  return next
}

/** The variant ids behind the ticked rows: a product row stands for all of its variants. */
export function selectedVariantIds(view: ViewRow[], selected: ReadonlySet<string>): string[] {
  const ids = new Set<string>()
  for (const r of view) {
    if (selected.has(r.viewKey)) for (const m of r.members) ids.add(m.variantId)
  }
  return [...ids]
}

/** Ticked variant rows only, for "Delete variants" (a product keeps at least one). */
export const tickedVariantRows = (view: ViewRow[], selected: ReadonlySet<string>) =>
  view.filter((r) => r.viewKind === 'variant' && selected.has(r.viewKey)).map((r) => r.variantId)
