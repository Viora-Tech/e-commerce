'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type DraftActionsCardProps = {
  /** Why the draft cannot convert yet (unsaved, no address); null when it can. */
  hint: string | null
  paymentMethod: string
  onPaymentMethod: (method: string) => void
  /** "Payment due later" terms (#1029); '' = paid now. */
  paymentTerms: string
  /** YYYY-MM-DD, used by fixed terms. */
  paymentDueDate: string
  onTerms: (next: { paymentTerms?: string; paymentDueDate?: string }) => void
}

export default function DraftActionsCard({
  hint,
  paymentMethod,
  onPaymentMethod,
  paymentTerms,
  paymentDueDate,
  onTerms,
}: DraftActionsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)

  // Render logic
  const methodItems = Object.entries(copy.methods).map(([value, label]) => ({ value, label }))
  const termItems = Object.entries(copy.terms.options).map(([value, label]) => ({ value, label }))
  const dueLater = paymentTerms !== ''
  return (
    <DataCard title={copy.actions.heading} bodyClassName="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="draft-method">{copy.paymentMethod}</FieldLabel>
        <Select
          items={methodItems}
          value={paymentMethod}
          onValueChange={(m) => m && onPaymentMethod(String(m))}
        >
          <SelectTrigger id="draft-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {methodItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-terms">{copy.terms.label}</FieldLabel>
        <Select
          items={termItems}
          value={paymentTerms}
          onValueChange={(t) => onTerms({ paymentTerms: String(t ?? '') })}
        >
          <SelectTrigger id="draft-terms" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {termItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dueLater ? <FieldDescription>{copy.terms.help}</FieldDescription> : null}
      </Field>
      {paymentTerms === 'fixed' ? (
        <Field>
          <FieldLabel htmlFor="draft-due-date">{copy.terms.dueDate}</FieldLabel>
          <Input
            id="draft-due-date"
            type="date"
            value={paymentDueDate}
            onChange={(e) => onTerms({ paymentDueDate: e.target.value })}
          />
        </Field>
      ) : null}
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </DataCard>
  )
}
