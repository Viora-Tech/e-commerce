'use client'

import { Switch } from '@commerce/ui/shadcn/switch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type DuplicateProductDialogProps = {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "What to copy" before a product is duplicated (audit #136, after Shopify): photos on, stock
 * off by default. Opens the copy once it exists.
 */
export default function DuplicateProductDialog({
  productId,
  open,
  onOpenChange,
}: DuplicateProductDialogProps) {
  // Hooks
  const { duplicate: copy } = useCopy(productFormContent)
  const router = useRouter()
  const [photos, setPhotos] = useState(true)
  const [stock, setStock] = useState(false)

  // Event handlers
  const handleSubmit = async () => {
    try {
      const { id } = await api.products.duplicate({ id: productId, photos, stock })
      toast.success(copy.toast)
      onOpenChange(false)
      router.push(routes.products.detail(id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const rows = [
    {
      id: 'duplicate-photos',
      label: copy.photos,
      help: copy.photosHelp,
      on: photos,
      set: setPhotos,
    },
    { id: 'duplicate-stock', label: copy.stock, help: copy.stockHelp, on: stock, set: setStock },
  ]

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.body}
      submitLabel={copy.submit}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor={row.id} className="text-body-strong text-foreground">
                {row.label}
              </label>
              <p className="text-caption text-muted-foreground">{row.help}</p>
            </div>
            <Switch id={row.id} checked={row.on} onCheckedChange={row.set} />
          </div>
        ))}
      </div>
    </FormDialog>
  )
}
