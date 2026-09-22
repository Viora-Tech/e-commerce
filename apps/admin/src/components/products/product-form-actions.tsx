'use client'

import { Copy, ExternalLink, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { productFormContent } from '@/data/products'
import type { LoadedProduct } from './form-state'

type ProductFormActionsProps = {
  product: LoadedProduct | null
  busy: boolean
  dirty: boolean
  storefrontOrigin: string
  onDuplicate: () => void
  onDelete: () => void
  onSave: () => void
}

const copy = productFormContent

/** Header actions: preview, duplicate and delete once saved; Save while creating. */
export default function ProductFormActions({
  product,
  busy,
  dirty,
  storefrontOrigin,
  onDuplicate,
  onDelete,
  onSave,
}: ProductFormActionsProps) {
  // Early returns
  if (!product) {
    if (dirty) return null
    return (
      <Button className="min-w-24" onClick={onSave} disabled={busy}>
        {copy.saveBar.save}
      </Button>
    )
  }

  // Render logic
  return (
    <>
      <Button
        variant="outline"
        className="min-w-24"
        render={
          <a
            href={`${storefrontOrigin}/products/${product.handle}`}
            target="_blank"
            rel="noreferrer"
          />
        }
        nativeButton={false}
      >
        {copy.preview}
        <ExternalLink />
      </Button>
      <Button variant="outline" className="min-w-24" onClick={onDuplicate} disabled={busy}>
        <Copy />
        {copy.duplicate.action}
      </Button>
      <Button variant="destructive" className="min-w-24" onClick={onDelete} disabled={busy}>
        <Trash2 />
        {copy.delete.action}
      </Button>
    </>
  )
}
