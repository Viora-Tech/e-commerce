'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import {
  Boxes,
  CircleCheck,
  Copy,
  ExternalLink,
  PackageX,
  Pencil,
  Trash2,
} from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { productFormContent } from '@/data/product-form'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ProductRowMenuProps = {
  product: { id: string; title: string; handle: string; status: ProductStatus }
  /** The store's public origin, for "View on store". */
  storefrontOrigin: string
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

/**
 * The ⋯ menu on a product row: edit, stock, duplicate, archive or activate, the live page and
 * delete, with the product page's own words so both places read the same.
 */
export default function ProductRowMenu({
  product,
  storefrontOrigin,
  onChanged,
}: ProductRowMenuProps) {
  // Hooks
  const list = useCopy(productsListContent)
  const form = useCopy(productFormContent)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleDuplicate = async () => {
    const copied = await api.products.duplicate({ id: product.id }).catch(() => null)
    if (!copied) return void toast.error(form.duplicate.failed)
    toast.success(form.duplicate.toast)
    router.push(routes.products.detail(copied.id))
  }

  const handleStatus = async (status: ProductStatus) => {
    const result = await api.products
      .bulk({ ids: [product.id], action: { kind: 'status', status } })
      .catch(() => null)
    if (!result) return void toast.error(list.bulk.failed)
    toast.success(list.bulk.updated(result.changed))
    onChanged()
  }

  const handleDelete = async () => {
    const result = await api.products.delete({ id: product.id }).catch(() => null)
    if (!result) return void toast.error(list.bulk.failed)
    toast.success(result.outcome === 'deleted' ? form.toasts.deleted : form.toasts.archived)
    onChanged()
  }

  // Render logic
  const detail = routes.products.detail(product.id)

  return (
    <>
      <RowMenu
        items={[
          { label: list.row.edit, icon: Pencil, href: detail },
          {
            label: list.row.inventory,
            icon: Boxes,
            href: `${routes.stock.inventory()}?query=${encodeURIComponent(product.title)}`,
          },
          { label: form.duplicate.action, icon: Copy, onSelect: handleDuplicate },
          {
            label: form.viewOnStore,
            icon: ExternalLink,
            href: `${storefrontOrigin}/products/${product.handle}`,
            newTab: true,
            hidden: product.status !== 'active',
          },
          {
            label: list.bulk.setActive,
            icon: CircleCheck,
            separatorBefore: true,
            hidden: product.status === 'active',
            onSelect: () => handleStatus('active'),
          },
          {
            label: list.bulk.archive,
            icon: PackageX,
            separatorBefore: product.status === 'active',
            hidden: product.status === 'archived',
            onSelect: () => handleStatus('archived'),
          },
          {
            label: form.delete.action,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={form.delete.title(product.title)}
        body={form.delete.body}
        confirmLabel={form.delete.confirm}
        cancelLabel={form.delete.cancel}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
