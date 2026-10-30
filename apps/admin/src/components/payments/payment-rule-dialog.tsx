'use client'

import { parsePincodeList } from '@commerce/core/checkout-settings'
import type { PaymentMethodRule } from '@commerce/core/payment-method-rules'
import { parseRupees } from '@commerce/money'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { itemTabs, loadPicked } from '@/components/discounts/pick-sources'
import PickedField from '@/components/pickers/picked-field'
import { discountFormContent } from '@/data/discounts'
import { paymentRulesContent } from '@/data/payment-rules'
import { useCopy, useLocale } from '@/hooks/use-copy'

type PaymentRuleDialogProps = {
  open: boolean
  /** The rule being edited, or null for a new one. */
  rule: PaymentMethodRule | null
  /** The ways to pay a rule can hide, with their names. */
  methods: { id: string; name: string }[]
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (rule: PaymentMethodRule) => void
}

type Draft = {
  name: string
  enabled: boolean
  methods: string[]
  match: 'any' | 'all'
  above: string
  below: string
  pincodes: string
  productIds: string[]
}

const rupees = (paise: number | null): string => (paise === null ? '' : String(paise / 100))

const draftOf = (rule: PaymentMethodRule | null): Draft => ({
  name: rule?.name ?? '',
  enabled: rule?.enabled ?? true,
  methods: rule?.methods ?? ['cod'],
  match: rule?.match ?? 'any',
  above: rupees(rule?.totalAbovePaise ?? null),
  below: rupees(rule?.totalBelowPaise ?? null),
  pincodes: (rule?.pincodes ?? []).join('\n'),
  productIds: rule?.productIds ?? [],
})

/** A blank box is no condition; anything else is rupees, as paise. */
const paiseOf = (text: string): number | null => (text.trim() ? (parseRupees(text) ?? null) : null)

const newId = (): string => `rule_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * Add or edit one payment rule (#150): what it hides, then when (total above or below, PIN
 * codes, products in the cart), any or all of them. Save hands the rule back; the card saves
 * the whole list.
 */
export default function PaymentRuleDialog({
  open,
  rule,
  methods,
  saving,
  onOpenChange,
  onSave,
}: PaymentRuleDialogProps) {
  // Hooks
  const { dialog: copy } = useCopy(paymentRulesContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const [draft, setDraft] = useState<Draft>(() => draftOf(rule))
  const [attempted, setAttempted] = useState(false)

  // Helpers
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  // Event handlers
  const handleMethod = (id: string, on: boolean) =>
    patch({ methods: on ? [...draft.methods, id] : draft.methods.filter((m) => m !== id) })
  const handleSave = () => {
    setAttempted(true)
    if (draft.methods.length === 0 || !hasCondition) return
    onSave({
      id: rule?.id ?? newId(),
      name: draft.name.trim(),
      enabled: draft.enabled,
      methods: draft.methods,
      match: draft.match,
      totalAbovePaise: abovePaise,
      totalBelowPaise: belowPaise,
      pincodes: pins.pincodes,
      productIds: draft.productIds,
    })
  }

  // Render logic
  const abovePaise = paiseOf(draft.above)
  const belowPaise = paiseOf(draft.below)
  const pins = parsePincodeList(draft.pincodes)
  const hasCondition =
    abovePaise !== null ||
    belowPaise !== null ||
    pins.pincodes.length > 0 ||
    draft.productIds.length > 0
  const productTabs = itemTabs(discountCopy.value, locale).filter((t) => t.key === 'products')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? copy.editTitle : copy.addTitle}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
          <Field>
            <FieldLabel htmlFor="payment-rule-name">{copy.name}</FieldLabel>
            <Input
              id="payment-rule-name"
              maxLength={80}
              placeholder={copy.namePlaceholder}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel htmlFor="payment-rule-on">{copy.enabled}</FieldLabel>
            <Switch
              id="payment-rule-on"
              checked={draft.enabled}
              onCheckedChange={(enabled) => patch({ enabled })}
            />
          </Field>
          <Field data-invalid={attempted && draft.methods.length === 0 ? true : undefined}>
            <FieldLabel>{copy.methods}</FieldLabel>
            <div className="flex flex-col gap-2">
              {methods.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-body">
                  <Checkbox
                    checked={draft.methods.includes(m.id)}
                    onCheckedChange={(on) => handleMethod(m.id, on === true)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
            {attempted && draft.methods.length === 0 ? (
              <FieldError>{copy.methodsError}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="payment-rule-match">{copy.match}</FieldLabel>
            <NativeSelect
              id="payment-rule-match"
              className="max-w-64"
              value={draft.match}
              onChange={(e) => patch({ match: e.target.value === 'all' ? 'all' : 'any' })}
            >
              <NativeSelectOption value="any">{copy.matchAny}</NativeSelectOption>
              <NativeSelectOption value="all">{copy.matchAll}</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment-rule-above">{copy.above}</FieldLabel>
              <Input
                id="payment-rule-above"
                inputMode="decimal"
                placeholder="₹"
                value={draft.above}
                onChange={(e) => patch({ above: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-rule-below">{copy.below}</FieldLabel>
              <Input
                id="payment-rule-below"
                inputMode="decimal"
                placeholder="₹"
                value={draft.below}
                onChange={(e) => patch({ below: e.target.value })}
              />
            </Field>
            <FieldDescription className="sm:col-span-2">{copy.totalHint}</FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="payment-rule-pincodes">{copy.pincodes}</FieldLabel>
            <Textarea
              id="payment-rule-pincodes"
              rows={3}
              value={draft.pincodes}
              onChange={(e) => patch({ pincodes: e.target.value })}
            />
            <FieldDescription>
              {pins.invalid.length > 0
                ? copy.pincodesInvalid(pins.invalid.join(', '))
                : copy.pincodesHint}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{copy.products}</FieldLabel>
            <PickedField
              kind="products"
              ids={draft.productIds}
              tabs={productTabs}
              title={copy.pickTitle}
              search={copy.search}
              labels={{
                browse: copy.browse,
                nothingPicked: copy.nothingPicked,
                remove: copy.removeProduct,
              }}
              loadPicked={(_kind, ids) => loadPicked('products', ids, discountCopy.value, locale)}
              onChange={({ ids }) => patch({ productIds: ids })}
            />
          </Field>
          {attempted && !hasCondition ? (
            <p className="text-body text-destructive">{copy.conditionsError}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
