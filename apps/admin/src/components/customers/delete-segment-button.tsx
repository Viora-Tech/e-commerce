'use client'

import { Trash2 } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
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
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      await api.customers.deleteSegment({ id })
      toast.success(content.builder.deleted)
      router.push(routes.customers.segments())
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  // Render logic
  const copy = content.builder
  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label={copy.delete}>
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteHeading}</AlertDialogTitle>
            <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              {copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
