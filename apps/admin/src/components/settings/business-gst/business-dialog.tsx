'use client'

import type { Business } from '@commerce/core'
import { BusinessInputSchema } from '@commerce/core/gst-registrations'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import GeneralTextField from '@/components/settings/general-text-field'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type BusinessDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edits this business; null adds another one. */
  business: Business | null
  /** The business has GST numbers, so its PAN is fixed. */
  panLocked: boolean
}

/** Add another business, or edit one: legal name, shop name and PAN. */
export default function BusinessDialog({
  open,
  onOpenChange,
  business,
  panLocked,
}: BusinessDialogProps) {
  // Hooks
  const all = useCopy(businessGstContent)
  const router = useRouter()
  const [form, setForm] = useState({ legalName: '', tradeName: '', pan: '' })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      legalName: business?.legalName ?? '',
      tradeName: business?.tradeName ?? '',
      pan: business?.pan ?? '',
    })
    setTouched(false)
  }, [open, business])

  // Helpers
  const errorAt = (key: string) => {
    if (!touched) return undefined
    const parsed = BusinessInputSchema.safeParse(form)
    return parsed.success
      ? undefined
      : parsed.error.issues.find((i) => i.path.join('.') === key)?.message
  }

  // Event handlers
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!BusinessInputSchema.safeParse(form).success) return
    setSaving(true)
    try {
      if (business) await api.businessGst.updateBusiness({ id: business.id, ...form })
      else await api.businessGst.createBusiness(form)
      toast.success(all.businessDialog.saved)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : all.businessDialog.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const copy = all.businessDialog
  const fields = all.business

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{business ? copy.editTitle : copy.addTitle}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {business ? null : (
            <p className="rounded-lg bg-warning/20 px-3 py-2 text-body text-warning-foreground dark:text-warning">
              {all.advanced.warning}
            </p>
          )}
          <FieldGroup>
            <GeneralTextField
              id="business-legal-name"
              label={fields.legalName}
              value={form.legalName}
              onChange={(legalName) => setForm((f) => ({ ...f, legalName }))}
              error={errorAt('legalName')}
              help={fields.legalNameHelp}
              autoComplete="organization"
            />
            <GeneralTextField
              id="business-trade-name"
              label={fields.tradeName}
              value={form.tradeName}
              onChange={(tradeName) => setForm((f) => ({ ...f, tradeName }))}
              help={fields.tradeNameHelp}
            />
            {panLocked ? (
              <div className="flex flex-col gap-1">
                <span className="text-body-strong text-ink-strong">{fields.pan}</span>
                <span className="font-mono text-body">{form.pan}</span>
                <span className="text-caption text-muted-foreground">{fields.panLocked}</span>
              </div>
            ) : (
              <GeneralTextField
                id="business-pan"
                label={fields.pan}
                value={form.pan}
                onChange={(pan) =>
                  setForm((f) => ({ ...f, pan: pan.toUpperCase().replace(/\s/g, '') }))
                }
                error={errorAt('pan')}
                help={fields.panHelp}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {copy.cancel}
            </DialogClose>
            <Button type="submit" disabled={saving}>
              <Save aria-hidden="true" />
              {copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
