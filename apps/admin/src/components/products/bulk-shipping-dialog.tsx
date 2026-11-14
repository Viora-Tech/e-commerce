'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { productBulkShippingContent } from '@/data/product-bulk-shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { bulkShippingChoice, KEEP, NONE } from './bulk-shipping-state'
import { useBoxPresets } from './use-box-presets'

type BulkShippingDialogProps = {
  /** The selected products; empty keeps the dialog closed. */
  ids: string[]
  onClose: () => void
  /** After a save: clear the selection and reload. */
  onDone: () => void
}

/**
 * "Set weight and box": one product weight and one box for every variant of the selected
 * products, or only the variants with one option value (XL). Packing comes from the box.
 */
export default function BulkShippingDialog({ ids, onClose, onDone }: BulkShippingDialogProps) {
  // Hooks
  const copy = useCopy(productBulkShippingContent)
  const boxes = useBoxPresets(ids.length > 0)
  const [weight, setWeight] = useState('')
  const [box, setBox] = useState(KEEP)
  const [option, setOption] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleClose = () => {
    setWeight('')
    setBox(KEEP)
    setOption('')
    onClose()
  }

  const handleApply = async () => {
    const { weightGrams, boxPresetId, ready } = bulkShippingChoice(weight, box)
    if (!ready) {
      toast.error(copy.nothing)
      return
    }
    setSaving(true)
    try {
      const result = await api.products.bulk({
        ids,
        action: {
          kind: 'shipping',
          weightGrams,
          boxPresetId,
          optionValue: option.trim() || undefined,
        },
      })
      if (result.changed === 0) toast.error(copy.noneMatched)
      else toast.success(copy.done(result.changed))
      handleClose()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const open = ids.length > 0
  const { ready } = bulkShippingChoice(weight, box)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.help(ids.length)}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-weight">{copy.weight}</FieldLabel>
          <Input
            id="bulk-weight"
            inputMode="numeric"
            value={weight}
            autoComplete="off"
            onChange={(e) => setWeight(e.target.value.replace(/\D/g, ''))}
          />
          <FieldDescription>{copy.weightHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="bulk-box">{copy.box}</FieldLabel>
          <NativeSelect id="bulk-box" value={box} onChange={(e) => setBox(e.target.value)}>
            <NativeSelectOption value={KEEP}>{copy.keepBox}</NativeSelectOption>
            {boxes.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {copy.boxSize(b.name, b.lengthCm, b.widthCm, b.heightCm, b.weightGrams ?? 0)}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={NONE}>{copy.noBox}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="bulk-option">{copy.option}</FieldLabel>
          <Input
            id="bulk-option"
            value={option}
            placeholder={copy.optionPlaceholder}
            autoComplete="off"
            onChange={(e) => setOption(e.target.value)}
          />
          <FieldDescription>{copy.optionHelp}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {copy.cancel}
          </Button>
          <Button loading={saving} onClick={() => void handleApply()} disabled={!ready || saving}>
            <CheckIcon aria-hidden="true" />
            {copy.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
