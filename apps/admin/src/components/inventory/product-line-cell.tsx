import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import type { inventoryContent } from '@/data/inventory'
import type { InventoryLine } from './inventory-tree'

type ProductLineCellProps = {
  line: InventoryLine
  copy: typeof inventoryContent
  /** Products view: the line's place in the tree; null in the SKUs view. */
  tree: { open: boolean; onToggle: () => void } | null
}

/* The chevron's slot, kept on every top-level line so the pictures line up. */
const TOGGLE = 'flex size-6 shrink-0 items-center justify-center rounded-md'

/**
 * The Product cell. In the Products view a product with several SKUs gets a chevron that
 * folds them, the SKUs under it are indented, and a single-SKU product reads like a SKU.
 */
export default function ProductLineCell({ line, copy, tree }: ProductLineCellProps) {
  // Render logic
  const variants = line.variants
  const subtitle = variants
    ? copy.tree.variants(variants.length)
    : line.variantTitle && line.variantTitle !== 'Default' && !line.nested
      ? line.variantTitle
      : null

  return (
    <span className={cn('flex items-center gap-2 text-left', line.nested && 'pl-8')}>
      {tree && !line.nested ? (
        variants ? (
          <button
            type="button"
            aria-expanded={tree.open}
            aria-label={
              tree.open
                ? copy.tree.collapse(line.productTitle)
                : copy.tree.expand(line.productTitle)
            }
            className={cn(
              TOGGLE,
              'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            )}
            onClick={(e) => {
              e.stopPropagation()
              tree.onToggle()
            }}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-4 transition-transform duration-150 ease-out motion-reduce:transition-none',
                tree.open && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span aria-hidden className={TOGGLE} />
        )
      ) : null}
      <ProductThumb url={line.imageUrl} />
      <span className="flex min-w-0 flex-col pl-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'line-clamp-1 text-body',
              line.nested ? 'text-foreground' : 'text-ink-strong',
            )}
          >
            {line.nested ? line.variantTitle : line.productTitle}
          </span>
          {line.hiddenOnStore ? (
            <StatusChip tone="neutral" variant="outline">
              {copy.tree.hidden}
            </StatusChip>
          ) : null}
        </span>
        {subtitle ? (
          <span className="line-clamp-1 text-caption text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  )
}
