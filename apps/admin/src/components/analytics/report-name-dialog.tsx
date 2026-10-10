'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type FormEvent, useState } from 'react'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

type ReportNameDialogProps = {
  title: string
  description?: string | undefined
  confirm: string
  /** The name the box starts with. */
  initialName: string
  onCancel: () => void
  /** Resolves when saved; the dialog shows a spinner meanwhile. */
  onConfirm: (name: string) => Promise<void>
}

/** Names a saved report: "Save report" on a report, and Rename on a saved one. */
export default function ReportNameDialog({
  title,
  description,
  confirm,
  initialName,
  onCancel,
  onConfirm,
}: ReportNameDialogProps) {
  // Hooks
  const copy = useCopy(analyticsContent.reports.save)
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await onConfirm(name.trim())
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="report-name">{copy.name}</FieldLabel>
            <Input
              id="report-name"
              size="lg"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <Spinner /> : null}
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
