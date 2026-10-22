'use client'

import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import MoneyInput from '@/components/fields/money-input'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { emptyRate, type RateDraft, rateErrors } from './form-state'

type RateDialogProps = {
  open: boolean
  /** The rate being edited; null adds a new one. */
  rate: RateDraft | null
  onOpenChange: (open: boolean) => void
  onDone: (rate: RateDraft) => void
}

let nextKey = 0
const freshKey = () => `new-${Date.now()}-${nextKey++}`

/** Add or edit one rate of a zone. Saved with the zone, not on its own. */
export default function RateDialog({ open, rate, onOpenChange, onDone }: RateDialogProps) {
  // Hooks
  const ratesCopy = useCopy(shippingRatesContent)
  const [draft, setDraft] = useState<RateDraft>(() => rate ?? emptyRate(freshKey()))
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(rate ?? emptyRate(freshKey()))
    setAttempted(false)
  }, [open, rate])

  // Helpers
  const patch = (p: Partial<RateDraft>) => setDraft((d) => ({ ...d, ...p }))

  // Event handlers
  const handleDone = () => {
    setAttempted(true)
    if (Object.keys(rateErrors(ratesCopy, draft)).length) return
    onDone(draft)
    onOpenChange(false)
  }

  // Render logic
  const copy = ratesCopy.rate
  const conditions = copy.conditions.map((c) => ({ value: c.value, label: c.label }))
  const errors = attempted ? rateErrors(ratesCopy, draft) : {}
  const banded = draft.condition !== 'none'
  const weight = draft.condition === 'weight'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rate ? copy.editTitle : copy.createTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="rate-name">{copy.name}</FieldLabel>
            <Input
              id="rate-name"
              size="lg"
              value={draft.name}
              placeholder={copy.namePlaceholder}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors.name ? (
              <FieldError>{errors.name}</FieldError>
            ) : (
              <FieldDescription>{copy.nameHelp}</FieldDescription>
            )}
          </Field>
          <Field data-invalid={errors.price ? true : undefined} className="max-w-48">
            <FieldLabel htmlFor="rate-price">{copy.price}</FieldLabel>
            <MoneyInput
              size="lg"
              id="rate-price"
              value={draft.price}
              onChange={(price) => patch({ price })}
              invalid={errors.price ? true : undefined}
            />
            {errors.price ? <FieldError>{errors.price}</FieldError> : null}
          </Field>
          <ChoiceField
            id="rate-condition"
            label={copy.condition}
            value={draft.condition}
            options={conditions}
            onChange={(v) => patch({ condition: v as RateDraft['condition'], min: '', max: '' })}
          />
          {banded ? (
            <Field data-invalid={errors.band ? true : undefined}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="rate-min">{copy.min}</FieldLabel>
                  <MoneyInput
                    size="lg"
                    id="rate-min"
                    value={draft.min}
                    onChange={(min) => patch({ min })}
                    currency={!weight}
                    suffix={weight ? copy.grams : undefined}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="rate-max">{copy.max}</FieldLabel>
                  <MoneyInput
                    size="lg"
                    id="rate-max"
                    value={draft.max}
                    onChange={(max) => patch({ max })}
                    currency={!weight}
                    suffix={weight ? copy.grams : undefined}
                    invalid={errors.band ? true : undefined}
                  />
                </div>
              </div>
              {errors.band ? (
                <FieldError>{errors.band}</FieldError>
              ) : (
                <FieldDescription>{copy.bandHelp}</FieldDescription>
              )}
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="rate-free-above">{copy.freeAbove}</FieldLabel>
            <div className="max-w-48">
              <MoneyInput
                size="lg"
                id="rate-free-above"
                value={draft.freeAbove}
                onChange={(freeAbove) => patch({ freeAbove })}
              />
            </div>
            <FieldDescription>{copy.freeAboveHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="rate-cod">{copy.codFee}</FieldLabel>
            <div className="max-w-48">
              <MoneyInput
                size="lg"
                id="rate-cod"
                value={draft.codFee}
                onChange={(codFee) => patch({ codFee })}
              />
            </div>
            <FieldDescription>{copy.codFeeHelp}</FieldDescription>
          </Field>
          <Field data-invalid={errors.transit ? true : undefined}>
            <FieldLabel>{copy.transit}</FieldLabel>
            <div className="grid max-w-72 grid-cols-2 gap-3">
              <MoneyInput
                size="lg"
                aria-label={copy.transitMin}
                placeholder={copy.transitMin}
                value={draft.minDays}
                onChange={(minDays) => patch({ minDays })}
                currency={false}
              />
              <MoneyInput
                size="lg"
                aria-label={copy.transitMax}
                placeholder={copy.transitMax}
                value={draft.maxDays}
                onChange={(maxDays) => patch({ maxDays })}
                currency={false}
                invalid={errors.transit ? true : undefined}
              />
            </div>
            {errors.transit ? (
              <FieldError>{errors.transit}</FieldError>
            ) : (
              <FieldDescription>{copy.transitHelp}</FieldDescription>
            )}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleDone}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
