'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Collection = Awaited<ReturnType<typeof api.collections.list>>[number]

type AddToCollectionDialogProps = {
  /** How many products are selected; zero keeps the dialog closed. */
  count: number
  busy: boolean
  onClose: () => void
  onApply: (collectionId: string) => void
}

/** Picks the manual collection the selected products join (automatic ones fill themselves). */
export default function AddToCollectionDialog({
  count,
  busy,
  onClose,
  onApply,
}: AddToCollectionDialogProps) {
  // Hooks
  const { bulk } = useCopy(productsListContent)
  const [collections, setCollections] = useState<Collection[] | null>(null)
  const [picked, setPicked] = useState('')

  useEffect(() => {
    if (count === 0) return
    let cancelled = false
    setCollections(null)
    api.collections
      .list()
      .then((rows) => {
        if (cancelled) return
        const manual = rows.filter((c) => c.kind === 'manual')
        setCollections(manual)
        setPicked(manual[0]?.id ?? '')
      })
      .catch(() => !cancelled && setCollections([]))
    return () => {
      cancelled = true
    }
  }, [count])

  // Render logic
  const copy = bulk.collection

  return (
    <Dialog open={count > 0} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.help(count)}</DialogDescription>
        </DialogHeader>
        {collections === null ? (
          <p className="text-body text-muted-foreground">{copy.loading}</p>
        ) : collections.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.none}</p>
        ) : (
          <Field>
            <FieldLabel htmlFor="bulk-collection">{copy.label}</FieldLabel>
            <NativeSelect
              id="bulk-collection"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              {collections.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button onClick={() => onApply(picked)} disabled={picked === ''} loading={busy}>
            <CheckIcon aria-hidden="true" />
            {copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
