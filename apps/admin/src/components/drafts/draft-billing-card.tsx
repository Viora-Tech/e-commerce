'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DraftAddressFields from '@/components/drafts/draft-address-fields'
import { billingGstinInvalid, type DraftFormState } from '@/components/drafts/draft-form-state'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type DraftBillingCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

/**
 * Where the bill goes. "Billing address is the same as shipping" is ticked by default; unticked,
 * a billing address with an optional company and GSTIN (checked like checkout's) for the GST
 * invoice. The place of supply stays the shipping state, as at checkout.
 */
export default function DraftBillingCard({ form, onChange }: DraftBillingCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)

  // Helpers
  const set = (patch: Partial<DraftFormState['billing']>) =>
    onChange({ billing: { ...form.billing, ...patch } })

  // Event handlers
  const handleSame = (same: boolean) => {
    // Unticking starts from the shipping address, so a different bill-to is a few edits away.
    const blank = !form.billing.name && !form.billing.line1
    onChange({
      billingSameAsShipping: same,
      ...(!same && blank ? { billing: { ...form.billing, ...form.address } } : {}),
    })
  }

  // Render logic
  const b = copy.billing
  const gstinBad = billingGstinInvalid(form)

  return (
    <DataCard title={b.heading} bodyClassName="flex flex-col gap-4">
      <Field orientation="horizontal">
        <Checkbox
          id="draft-billing-same"
          checked={form.billingSameAsShipping}
          onCheckedChange={(v) => handleSame(v === true)}
        />
        <FieldLabel htmlFor="draft-billing-same">{b.same}</FieldLabel>
      </Field>
      {form.billingSameAsShipping ? null : (
        <DraftAddressFields
          idPrefix="draft-bill"
          address={form.billing}
          onChange={(address) => set(address)}
          afterName={
            <>
              <Field>
                <FieldLabel htmlFor="draft-bill-business">{b.businessName}</FieldLabel>
                <Input
                  id="draft-bill-business"
                  autoComplete="organization"
                  value={form.billing.businessName}
                  onChange={(e) => set({ businessName: e.target.value })}
                />
              </Field>
              <Field data-invalid={gstinBad || undefined}>
                <FieldLabel htmlFor="draft-bill-gstin">{b.gstin}</FieldLabel>
                <Input
                  id="draft-bill-gstin"
                  className="font-mono uppercase"
                  maxLength={15}
                  aria-invalid={gstinBad || undefined}
                  value={form.billing.gstin}
                  onChange={(e) => set({ gstin: e.target.value.toUpperCase().trim() })}
                />
                {gstinBad ? (
                  <FieldError>{b.gstinInvalid}</FieldError>
                ) : (
                  <FieldDescription>{b.gstinHelp}</FieldDescription>
                )}
              </Field>
            </>
          }
        />
      )}
    </DataCard>
  )
}
