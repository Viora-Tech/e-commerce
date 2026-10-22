'use client'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'

type CustomerBusinessCardProps = {
  gstin: string
  businessName: string
  /** Why the typed GSTIN is refused; null while it is blank or valid. */
  gstinError: string | null
  onChange: (next: { gstin?: string; businessName?: string }) => void
}

/** GSTIN and legal name for B2B invoices; the page's save bar saves them with the other edits. */
export default function CustomerBusinessCard({
  gstin,
  businessName,
  gstinError,
  onChange,
}: CustomerBusinessCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)

  return (
    <DataCard
      title={detail.business.heading}
      className="rounded-xl"
      bodyClassName="flex flex-col gap-4"
    >
      <Field data-invalid={gstinError ? true : undefined}>
        <FieldLabel htmlFor="customer-gstin">{detail.business.gstin}</FieldLabel>
        <Input
          id="customer-gstin"
          value={gstin}
          maxLength={15}
          autoComplete="off"
          spellCheck={false}
          className="uppercase placeholder:normal-case"
          placeholder={detail.business.gstinPlaceholder}
          aria-invalid={gstinError ? true : undefined}
          onChange={(e) => onChange({ gstin: e.target.value })}
        />
        {gstinError ? <FieldError>{gstinError}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="customer-business-name">{detail.business.businessName}</FieldLabel>
        <Input
          id="customer-business-name"
          value={businessName}
          maxLength={120}
          placeholder={detail.business.businessNamePlaceholder}
          onChange={(e) => onChange({ businessName: e.target.value })}
        />
        <FieldDescription>{detail.business.hint}</FieldDescription>
      </Field>
    </DataCard>
  )
}
