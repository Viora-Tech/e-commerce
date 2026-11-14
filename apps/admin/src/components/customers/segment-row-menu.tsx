'use client'

import { Trash2, Users } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type SegmentRowMenuProps = { id: string }

/** The ⋯ menu on a segment row: who is in it now, or delete the saved filter. */
export default function SegmentRowMenu({ id }: SegmentRowMenuProps) {
  // Hooks
  const { builder: copy } = useCopy(segmentsContent)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    try {
      await api.customers.deleteSegment({ id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.deleteFailed)
      throw err
    }
    toast.success(copy.deleted)
    router.refresh()
  }

  return (
    <>
      <RowMenu
        items={[
          { label: copy.viewCustomers, icon: Users, href: routes.customers.segment(id) },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.deleteHeading}
        body={copy.deleteBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        onConfirm={handleDelete}
      />
    </>
  )
}
