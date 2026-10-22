'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import DiscountCodeField from '../discount-code-field'

type DiscountPick = { code: string; heading: string; note: string }

type BuilderDiscountDialogProps = {
  open: boolean
  /** The pick, or null when cancelled (the dropped placeholder then stays). */
  onDone: (picked: DiscountPick | null) => void
}

/** Picks an active code from Discounts for a dropped discount block. */
export default function BuilderDiscountDialog({ open, onDone }: BuilderDiscountDialogProps) {
  // Hooks
  const { discount: copy } = useCopy(emailBuilderContent)
  const [code, setCode] = useState('')
  const [heading, setHeading] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Event handlers
  const handleClose = (picked: DiscountPick | null) => {
    setCode('')
    setHeading(null)
    setNote('')
    onDone(picked)
  }

  // Render logic
  const shownHeading = heading ?? copy.headingDefault

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <DiscountCodeField id="builder-discount-code" value={code} onChange={setCode} />
          <Field>
            <FieldLabel htmlFor="builder-discount-heading">{copy.heading}</FieldLabel>
            <Input
              id="builder-discount-heading"
              value={shownHeading}
              maxLength={200}
              onChange={(e) => setHeading(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="builder-discount-note">{copy.note}</FieldLabel>
            <Input
              id="builder-discount-note"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(null)}>
            {copy.cancel}
          </Button>
          <Button
            onClick={() => handleClose({ code, heading: shownHeading, note })}
            disabled={!code}
          >
            <Plus aria-hidden="true" />
            {copy.insert}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
