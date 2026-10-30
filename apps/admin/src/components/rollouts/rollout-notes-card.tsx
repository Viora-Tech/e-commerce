'use client'

import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import DataCard from '@/components/layout/data-card'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'

type RolloutNotesCardProps = {
  notes: string
  disabled: boolean
  onChange: (notes: string) => void
}

/** The team's notes on a rollout: why it runs and what would make them ship it. */
export default function RolloutNotesCard({ notes, disabled, onChange }: RolloutNotesCardProps) {
  // Hooks
  const { notes: copy } = useCopy(rolloutsContent).form

  return (
    <DataCard title={copy.heading}>
      <Field>
        <Textarea
          id="rollout-notes"
          aria-label={copy.heading}
          rows={4}
          maxLength={2000}
          value={notes}
          placeholder={copy.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <FieldDescription>{copy.help}</FieldDescription>
      </Field>
    </DataCard>
  )
}
