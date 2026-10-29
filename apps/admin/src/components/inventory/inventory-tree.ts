import type { InventoryRow } from './inventory-columns'

/**
 * A row of the inventory table. In the Products view a product with two or more SKUs becomes
 * one summary line (`variants` set, counts summed) with its SKUs as `nested` lines under it.
 */
export type InventoryLine = InventoryRow & {
  /** On a product summary line: its SKUs, drawn underneath when expanded. */
  variants?: InventoryLine[]
  /** A SKU drawn under its product's summary line. */
  nested?: boolean
}

/** Summary lines carry this before the product id, so they never clash with a variant id. */
const PRODUCT_LINE = 'product:'

export function productLineId(productId: string): string {
  return `${PRODUCT_LINE}${productId}`
}

export function isProductLine(line: InventoryLine): boolean {
  return line.variants !== undefined
}

/**
 * One line per product, in the order the API sent them (a page of whole products). A product
 * with a single SKU stays that SKU's own line, so its quantity is edited in place.
 */
export function groupByProduct(rows: InventoryRow[]): InventoryLine[] {
  const byProduct = new Map<string, InventoryRow[]>()
  for (const row of rows) {
    const skus = byProduct.get(row.productId)
    if (skus) skus.push(row)
    else byProduct.set(row.productId, [row])
  }
  return [...byProduct.values()].map((skus) => {
    const [first] = skus as [InventoryRow, ...InventoryRow[]]
    if (skus.length === 1) return first
    const sum = (pick: (r: InventoryRow) => number) => skus.reduce((n, r) => n + pick(r), 0)
    return {
      ...first,
      variantId: productLineId(first.productId),
      variantTitle: '',
      sku: null,
      imageUrl: first.productImageUrl ?? first.imageUrl,
      costPaise: null,
      onHand: sum((r) => r.onHand),
      committed: sum((r) => r.committed),
      available: sum((r) => r.available),
      incoming: sum((r) => r.incoming),
      variants: skus.map((r) => ({ ...r, nested: true })),
    }
  })
}

/** Every product line expanded, or none, as the table's expanded state. */
export function expandAll(lines: InventoryLine[], open: boolean): Record<string, boolean> {
  return open ? Object.fromEntries(lines.filter(isProductLine).map((l) => [l.variantId, true])) : {}
}
