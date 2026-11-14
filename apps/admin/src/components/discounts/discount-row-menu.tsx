'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { discountFormContent, discountsContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type DiscountRowMenuProps = {
  discount: { id: string; title: string; code: string | null; lifecycle: string }
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

/**
 * The ⋯ menu on a discount row: edit, copy the code, pause or resume, duplicate and delete,
 * the same actions (and words) as the discount page's header, so a code can be switched off
 * from the list.
 */
export default function DiscountRowMenu({ discount, onChanged }: DiscountRowMenuProps) {
  // Hooks
  const copy = useCopy(discountFormContent)
  const list = useCopy(discountsContent)
  const router = useRouter()
  const [confirm, setConfirm] = useState<'pause' | 'delete' | null>(null)

  // Event handlers
  const handleStatus = async (status: 'active' | 'disabled') => {
    const result = await api.discounts.toggle({ id: discount.id, status }).catch(() => null)
    if (!result) return void toast.error(copy.toasts.failed)
    toast.success(status === 'disabled' ? copy.toasts.paused : copy.toasts.resumed)
    onChanged()
  }

  const handleCopyCode = async () => {
    if (!discount.code) return
    try {
      await navigator.clipboard.writeText(discount.code.toUpperCase())
      toast.success(list.row.codeCopied)
    } catch {
      // Clipboard blocked: the code is in the row to copy by hand.
    }
  }

  const handleDuplicate = async () => {
    const copied = await api.discounts.duplicate({ id: discount.id }).catch(() => null)
    if (!copied) return void toast.error(copy.toasts.failed)
    toast.success(copy.toasts.duplicated)
    router.push(routes.discounts.detail(copied.id))
  }

  const handleDelete = async () => {
    const result = await api.discounts.delete({ id: discount.id }).catch(() => null)
    if (!result) return void toast.error(copy.toasts.failed)
    toast.success(result.outcome === 'deleted' ? copy.toasts.deleted : copy.toasts.disabled)
    onChanged()
  }

  // Render logic
  const paused = discount.lifecycle === 'disabled'

  return (
    <>
      <RowMenu
        items={[
          { label: list.row.edit, href: routes.discounts.detail(discount.id) },
          { label: list.row.copyCode, hidden: !discount.code, onSelect: handleCopyCode },
          paused
            ? { label: copy.pause.resume, onSelect: () => handleStatus('active') }
            : { label: copy.pause.action, onSelect: () => setConfirm('pause') },
          { label: copy.duplicate.action, onSelect: handleDuplicate },
          { label: copy.delete.action, destructive: true, onSelect: () => setConfirm('delete') },
        ]}
      />
      <ConfirmDialog
        open={confirm === 'pause'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.pause.title(discount.title)}
        body={copy.pause.body}
        confirmLabel={copy.pause.confirm}
        cancelLabel={copy.pause.cancel}
        tone="default"
        stopPropagation
        onConfirm={() => handleStatus('disabled')}
      />
      <ConfirmDialog
        tone="destructive"
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.delete.title(discount.title)}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
