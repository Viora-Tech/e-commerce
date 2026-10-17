'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type DeleteSegmentButtonProps = { id: string }

/** Removes the saved filter; customers are untouched. */
export default function DeleteSegmentButton({ id }: DeleteSegmentButtonProps) {
  // Hooks
  const content = useCopy(segmentsContent)
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    await api.customers.deleteSegment({ id })
    toast.success(content.builder.deleted)
    router.push(routes.customers.segments())
  }

  // Render logic
  const copy = content.builder
  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label={copy.delete}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.deleteHeading}
        body={copy.deleteBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        onConfirm={handleDelete}
      />
    </>
  )
}
