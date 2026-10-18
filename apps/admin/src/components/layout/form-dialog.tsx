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
import { type FormEvent, type ReactNode, useState } from 'react'
import { dialogContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  /** Defaults to the shared "Cancel". */
  cancelLabel?: string
  /** Busy state owned by the caller; a promise returned by `onSubmit` also keeps the dialog busy. */
  busy?: boolean
  /** Keeps the submit button off while the fields are not valid yet. */
  submitDisabled?: boolean
  /** Runs on submit. The caller closes the dialog (and toasts) when the work succeeds. */
  onSubmit: () => void | Promise<void>
  /** The fields, rendered between the header and the footer. */
  children: ReactNode
  size?: 'default' | 'md' | 'lg'
  /** For dialogs rendered inside a clickable row. */
  stopPropagation?: boolean
}

const SIZE_CLASS = {
  default: undefined,
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
} as const

/** The one form popup: a title, the fields, and a cancel + submit footer. */
export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel,
  busy = false,
  submitDisabled = false,
  onSubmit,
  children,
  size = 'default',
  stopPropagation = false,
}: FormDialogProps) {
  // Hooks
  const shared = useCopy(dialogContent)
  const [pending, setPending] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next && (pending || busy)) return
    onOpenChange(next)
  }
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const result = onSubmit()
    if (!(result instanceof Promise)) return
    setPending(true)
    try {
      await result
    } catch {
      // The caller reports the failure; the fields stay as typed.
    } finally {
      setPending(false)
    }
  }

  // Render logic
  const working = pending || busy
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={SIZE_CLASS[size]}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={working}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel ?? shared.cancel}
            </Button>
            <Button type="submit" loading={working} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
