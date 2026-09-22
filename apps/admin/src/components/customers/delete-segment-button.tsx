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
import { segmentsContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'

type DeleteSegmentButtonProps = { id: string }

const builder = copy.builder

/** Removes the saved filter; customers are untouched. */
export default function DeleteSegmentButton({ id }: DeleteSegmentButtonProps) {
  // Hooks
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    setBusy(true)
    try {
      await api.customers.deleteSegment({ id })
      toast.success(builder.deleted)
      router.push('/customers/segments')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  // Render logic
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={builder.delete}>
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{builder.deleteHeading}</AlertDialogTitle>
            <AlertDialogDescription>{builder.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{builder.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              {builder.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
