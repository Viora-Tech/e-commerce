'use client'

import type { DomainView } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { domainsContent as copy } from '@/data/domains'
import { api } from '@/lib/api-client'

type ChangePrimaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Domains that qualify: connected, with an active certificate. */
  domains: DomainView[]
  currentId: string | null
}

/** Pick which connected domain shoppers land on. */
export default function ChangePrimaryDialog({
  open,
  onOpenChange,
  domains,
  currentId,
}: ChangePrimaryDialogProps) {
  // Hooks
  const router = useRouter()
  const [selected, setSelected] = useState(currentId ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setSelected(currentId ?? '')
  }, [open, currentId])

  // Event handlers
  const handleSave = async () => {
    const target = domains.find((d) => d.id === selected)
    if (!target) return
    setSaving(true)
    try {
      await api.domains.setPrimary({ id: target.id })
      toast.success(copy.detail.madePrimary(target.hostname))
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.action)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.primary.change}</DialogTitle>
          <DialogDescription>{copy.primary.body}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={selected} onValueChange={(v) => setSelected(String(v))}>
          {domains.map((d) => (
            <Field key={d.id} orientation="horizontal">
              <RadioGroupItem id={`primary-${d.id}`} value={d.id} />
              <FieldLabel htmlFor={`primary-${d.id}`} className="font-normal">
                {d.hostname}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {copy.detail.removeCancel}
          </DialogClose>
          <Button disabled={saving || !selected || selected === currentId} onClick={handleSave}>
            {copy.detail.makePrimary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
