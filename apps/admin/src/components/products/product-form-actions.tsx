'use client'

import { Copy, ExternalLink, Trash2 } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import KitButton from '@/components/kit/kit-button'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { LoadedProduct } from './form-state'

type ProductFormActionsProps = {
  product: LoadedProduct
  busy: boolean
  storefrontOrigin: string
  onDuplicate: () => void
  onDelete: () => void
}

/** Preview, duplicate and delete for a saved product; publishing lives on the frame's buttons. */
export default function ProductFormActions({
  product,
  busy,
  storefrontOrigin,
  onDuplicate,
  onDelete,
}: ProductFormActionsProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Render logic
  return (
    <Card size="form" inset={4}>
      <CardContent className="flex flex-wrap gap-2 p-0">
        <KitButton
          variant="secondary"
          href={`${storefrontOrigin}/products/${product.handle}`}
          className="flex-auto"
        >
          {copy.preview}
          <ExternalLink className="size-4" aria-hidden="true" />
        </KitButton>
        <KitButton variant="secondary" className="flex-auto" onClick={onDuplicate} disabled={busy}>
          <Copy className="size-4" aria-hidden="true" />
          {copy.duplicate.action}
        </KitButton>
        <KitButton
          variant="secondary"
          className="flex-auto border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {copy.delete.action}
        </KitButton>
      </CardContent>
    </Card>
  )
}
