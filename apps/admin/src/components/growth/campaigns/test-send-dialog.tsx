'use client'

import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import type { CampaignForm } from './form-state'

type TestSendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CampaignForm
  /** The signed-in merchant's address, prefilled. */
  defaultTo: string
}

const copy = campaignEditorContent.test

/** Sends the current, possibly unsaved, email to one address. */
export default function TestSendDialog({
  open,
  onOpenChange,
  form,
  defaultTo,
}: TestSendDialogProps) {
  // Hooks
  const [to, setTo] = useState(defaultTo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSend = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.marketing.campaigns.testSend({
        to: to.trim(),
        subject: form.subject,
        previewText: form.previewText,
        blocks: form.blocks,
        design: form.editor === 'visual' ? form.design : null,
        testPrefix: copy.prefix,
      })
      toast.success(copy.sent(to.trim()))
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="test-to">{copy.to}</FieldLabel>
          <Input id="test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <DialogFooter>
          <Button onClick={handleSend} disabled={busy || !to.includes('@')}>
            <Send aria-hidden="true" />
            {copy.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
