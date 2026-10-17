'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
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
  saved: boolean
  busy: boolean
  paymentMethod: string
  onPaymentMethod: (method: string) => void
  onDelete: () => void
}

export default function DraftActionsCard({
  saved,
  busy,
  paymentMethod,
  onPaymentMethod,
  onDelete,
}: DraftActionsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)

  // Render logic
  const methodItems = Object.entries(copy.methods).map(([value, label]) => ({ value, label }))
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
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          className="text-danger hover:text-danger"
          disabled={!saved || busy}
          onClick={onDelete}
        >
          <Trash2 />
          {copy.actions.delete}
        </Button>
      </div>
      {saved ? null : (
        <p className="text-caption text-muted-foreground">{copy.actions.saveFirst}</p>
      )}
    </DataCard>
  )
}
